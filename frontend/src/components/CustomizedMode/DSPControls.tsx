/**
 * DSPControls Component
 * 
 * DSP (Digital Signal Processing) mode controls for band EQ customization.
 * Manages mode selection, multi-window sliders, and reset functionality.
 * Contains all DSP-specific business logic and state management.
 * 
 * @example
 * ```tsx
 * <DSPControls
 *   onBandSpecsChange={(specs) => applyEQ(specs)}
 *   disabled={false}
 * />
 * ```
 */

import { useState, useEffect } from 'react';
import type { CustomizedMode, SliderSpec, BandSpec } from '../../model/types';
import { 
  loadCustomizedMode, 
  initializeSliderScales, 
  validateScale, 
  buildBandSpecsFromSliders 
} from '../../lib/modes';
import { AVAILABLE_CUSTOMIZED_MODES } from '../../config/customizedModes';

interface DSPControlsProps {
  /** Callback when band specifications change */
  onBandSpecsChange: (bandSpecs: BandSpec[]) => void;
  
  /** Disable all controls */
  disabled?: boolean;
}

/**
 * DSPControls - Manages DSP band EQ mode selection and slider controls
 */
export function DSPControls({ 
  onBandSpecsChange, 
  disabled = false 
}: DSPControlsProps) {
  
  // DSP mode state
  const [currentMode, setCurrentMode] = useState<CustomizedMode | null>(null);
  const [currentModeId, setCurrentModeId] = useState<string>('');
  const [sliderScales, setSliderScales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load initial mode on mount
   */
  useEffect(() => {
    const loadInitialMode = async () => {
      if (AVAILABLE_CUSTOMIZED_MODES.length > 0) {
        await handleModeSelect(AVAILABLE_CUSTOMIZED_MODES[0]);
      }
    };
    loadInitialMode();
  }, []);

  /**
   * Load a specific DSP mode and initialize its sliders
   */
  const handleModeSelect = async (modeName: string) => {
    setLoading(true);
    setError(null);

    try {
      const mode = await loadCustomizedMode(modeName);
      setCurrentMode(mode);
      setCurrentModeId(modeName);
      
      // Initialize slider scales
      const initialScales = initializeSliderScales(mode.sliders);
      const scalesRecord = Object.fromEntries(initialScales);
      setSliderScales(scalesRecord);
      
      // Build and emit band specs
      const bandSpecs = buildBandSpecsFromSliders(mode.sliders, initialScales);
      onBandSpecsChange(bandSpecs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mode');
      console.error('[DSPControls] Mode load error:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle mode selection dropdown change
   */
  const handleModeSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    handleModeSelect(event.target.value);
  };

  /**
   * Handle slider value change
   */
  const handleSliderChange = (sliderId: string, value: number) => {
    if (!currentMode) return;
    
    const validatedValue = validateScale(value);
    const updatedScales = { ...sliderScales, [sliderId]: validatedValue };
    setSliderScales(updatedScales);
    
    // Convert to Map for buildBandSpecsFromSliders
    const scalesMap = new Map(Object.entries(updatedScales));
    const bandSpecs = buildBandSpecsFromSliders(currentMode.sliders, scalesMap);
    onBandSpecsChange(bandSpecs);
  };

  /**
   * Reset all sliders to default values
   */
  const handleReset = () => {
    if (!currentMode) return;
    
    const defaultScales = initializeSliderScales(currentMode.sliders);
    const scalesRecord = Object.fromEntries(defaultScales);
    setSliderScales(scalesRecord);
    
    const bandSpecs = buildBandSpecsFromSliders(currentMode.sliders, defaultScales);
    onBandSpecsChange(bandSpecs);
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="dsp-controls-loading">
        <div className="spinner"></div>
        <p>Loading mode...</p>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="dsp-controls-error">
        <p className="error-message">{error}</p>
        <button 
          onClick={() => handleModeSelect(AVAILABLE_CUSTOMIZED_MODES[0])}
          className="retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  /**
   * Render main DSP controls
   */
  if (!currentMode) {
    return null;
  }

  return (
    <div className="dsp-controls">
      {/* Mode Header */}
      <div className="mode-header">
        <div className="mode-info">
          <h2>{currentMode.name}</h2>
          <p className="mode-description">{currentMode.description}</p>
        </div>
        
        <div className="mode-actions">
          {/* Mode Selector Dropdown */}
          <select 
            className="mode-selector-dropdown"
            value={currentModeId}
            onChange={handleModeSelectChange}
            disabled={disabled || loading}
            aria-label="Select customized EQ mode"
          >
            {AVAILABLE_CUSTOMIZED_MODES.map((modeName: string) => (
              <option key={modeName} value={modeName}>
                {modeName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </option>
            ))}
          </select>
          
          {/* Reset Button */}
          <button 
            onClick={handleReset} 
            disabled={disabled} 
            className="reset-button"
            aria-label="Reset all sliders to default values"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Sliders Container */}
      <fieldset disabled={disabled} className="sliders-container">
        <legend className="sr-only">EQ Band Controls</legend>
        {currentMode.sliders.map((slider) => (
          <MultiWindowSlider
            key={slider.id}
            slider={slider}
            value={sliderScales[slider.id] ?? slider.defaultScale}
            onChange={(value) => handleSliderChange(slider.id, value)}
          />
        ))}
      </fieldset>
    </div>
  );
}

/**
 * MultiWindowSlider - Individual slider component for multi-window frequency bands
 */
interface MultiWindowSliderProps {
  slider: SliderSpec;
  value: number;
  onChange: (value: number) => void;
}

function MultiWindowSlider({ slider, value, onChange }: MultiWindowSliderProps) {
  const windowsText = slider.windows
    .map(w => `${Math.round(w.f_start_hz)}-${Math.round(w.f_end_hz)} Hz`)
    .join(', ');

  return (
    <div className="multi-window-slider">
      <div className="slider-header">
        <label htmlFor={`slider-${slider.id}`}>
          {slider.label}
          <span className="windows-badge" title={`Frequency ranges: ${windowsText}`}>
            {slider.windows.length} {slider.windows.length === 1 ? 'window' : 'windows'}
          </span>
        </label>
        <span className="scale-value" aria-live="polite">
          {value.toFixed(2)}×
        </span>
      </div>
      
      <input
        id={`slider-${slider.id}`}
        type="range"
        min="0"
        max="2"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={`${slider.label} gain control`}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(2)} times`}
        aria-describedby={`windows-${slider.id}`}
      />
      
      <div className="slider-labels">
        <span>0.0× (mute)</span>
        <span>1.0× (unity)</span>
        <span>2.0× (double)</span>
      </div>
      
      <details className="windows-details">
        <summary id={`windows-${slider.id}`}>Frequency Windows</summary>
        <ul className="windows-list">
          {slider.windows.map((window, idx) => (
            <li key={idx}>
              {Math.round(window.f_start_hz)} - {Math.round(window.f_end_hz)} Hz
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
