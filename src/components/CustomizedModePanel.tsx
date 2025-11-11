/**
 * Customized Mode Panel: Renders multi-window sliders for advanced EQ modes
 */

import { useState, useEffect } from 'react';
import { CustomizedMode, SliderSpec, BandSpec } from '../model/types';
import { loadCustomizedMode, initializeSliderScales, validateScale, buildBandSpecsFromSliders } from '../lib/modes';
import { AVAILABLE_CUSTOMIZED_MODES } from '../config/customizedModes';

interface CustomizedModePanelProps {
  onBandSpecsChange: (bandSpecs: BandSpec[]) => void;
  disabled?: boolean;
}

export default function CustomizedModePanel({ onBandSpecsChange, disabled = false }: CustomizedModePanelProps) {
  const [currentMode, setCurrentMode] = useState<CustomizedMode | null>(null);
  const [currentModeId, setCurrentModeId] = useState<string>('');
  const [sliderScales, setSliderScales] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load first mode on mount
  useEffect(() => {
    const loadInitialMode = async () => {
      if (AVAILABLE_CUSTOMIZED_MODES.length > 0) {
        await handleModeSelect(AVAILABLE_CUSTOMIZED_MODES[0]);
      }
    };
    loadInitialMode();
  }, [])

  const handleModeSelect = async (modeName: string) => {
    setLoading(true);
    setError(null);

    try {
      const mode = await loadCustomizedMode(modeName);
      setCurrentMode(mode);
      setCurrentModeId(modeName); // Track the mode ID
      
      const initialScales = initializeSliderScales(mode.sliders);
      setSliderScales(initialScales);
      const bandSpecs = buildBandSpecsFromSliders(mode.sliders, initialScales);
      onBandSpecsChange(bandSpecs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mode');
      console.error('Mode load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    handleModeSelect(event.target.value);
  };

  const handleSliderChange = (sliderId: string, value: number) => {
    if (!currentMode) return;
    
    const validatedValue = validateScale(value);
    const updatedScales = new Map(sliderScales);
    updatedScales.set(sliderId, validatedValue);
    setSliderScales(updatedScales);
    
    const bandSpecs = buildBandSpecsFromSliders(currentMode.sliders, updatedScales);
    onBandSpecsChange(bandSpecs);
  };

  const handleReset = () => {
    if (!currentMode) return;
    const defaultScales = initializeSliderScales(currentMode.sliders);
    setSliderScales(defaultScales);
    const bandSpecs = buildBandSpecsFromSliders(currentMode.sliders, defaultScales);
    onBandSpecsChange(bandSpecs);
  };

  if (loading) {
    return (
      <div className="customized-mode-panel">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading mode...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customized-mode-panel">
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => handleModeSelect(AVAILABLE_CUSTOMIZED_MODES[0])}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!currentMode) {
    return null;
  }

  return (
    <div className="customized-mode-panel">
      <div className="mode-header">
        <div className="mode-info">
          <h2>{currentMode.name}</h2>
          <p className="mode-description">{currentMode.description}</p>
        </div>
        <div className="mode-actions">
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
          <button onClick={handleReset} disabled={disabled} className="reset-button">
            Reset to Defaults
          </button>
        </div>
      </div>

      <fieldset disabled={disabled} className="sliders-container">
        {currentMode.sliders.map((slider) => (
          <MultiWindowSlider
            key={slider.id}
            slider={slider}
            value={sliderScales.get(slider.id) ?? slider.defaultScale}
            onChange={(value) => handleSliderChange(slider.id, value)}
          />
        ))}
      </fieldset>
    </div>
  );
}

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
