/**
 * DSPControls Component
 * 
 * Advanced DSP (Digital Signal Processing) mode controls for custom band EQ.
 * Features multi-window frequency sliders with visual feedback and presets.
 * 
 * @example
 * ```tsx
 * <DSPControls
 *   onBandSpecsChange={(specs) => applyEQ(specs)}
 *   disabled={false}
 * />
 * ```
 */

import { useState, useEffect, useMemo } from 'react';
import type { CustomizedMode, SliderSpec, BandSpec } from '../../model/types';
import { 
  loadCustomizedMode, 
  initializeSliderScales, 
  validateScale, 
  buildBandSpecsFromSliders 
} from '../../lib/modes';
import { AVAILABLE_CUSTOMIZED_MODES } from '../../config/customizedModes';
import './CustomizedMode.css';

interface DSPControlsProps {
  /** Callback when band specifications change */
  onBandSpecsChange: (bandSpecs: BandSpec[]) => void;
  
  /** Disable all controls */
  disabled?: boolean;
}

// Icons for different frequency ranges
const getFrequencyIcon = (label: string): string => {
  const labelLower = label.toLowerCase();
  if (labelLower.includes('sub') || labelLower.includes('bass')) return '🔊';
  if (labelLower.includes('low')) return '📢';
  if (labelLower.includes('mid')) return '🎵';
  if (labelLower.includes('high') || labelLower.includes('treble')) return '✨';
  if (labelLower.includes('presence')) return '🎤';
  if (labelLower.includes('air') || labelLower.includes('brilliance')) return '💫';
  if (labelLower.includes('vocal')) return '🗣️';
  if (labelLower.includes('guitar')) return '🎸';
  if (labelLower.includes('drum') || labelLower.includes('kick')) return '🥁';
  if (labelLower.includes('piano') || labelLower.includes('key')) return '🎹';
  return '🎚️';
};

// Get mode icon based on mode name
const getModeIcon = (modeName: string): string => {
  const nameLower = modeName.toLowerCase();
  if (nameLower.includes('generic')) return '🎛️';
  if (nameLower.includes('vocal') || nameLower.includes('voice')) return '🎤';
  if (nameLower.includes('music') || nameLower.includes('instrument')) return '🎵';
  if (nameLower.includes('master')) return '🎚️';
  if (nameLower.includes('podcast') || nameLower.includes('speech')) return '🎙️';
  return '⚙️';
};

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

  // Calculate if any sliders have been modified from defaults
  const hasModifications = useMemo(() => {
    if (!currentMode) return false;
    return currentMode.sliders.some(
      slider => sliderScales[slider.id] !== slider.defaultScale
    );
  }, [currentMode, sliderScales]);

  // Calculate total frequency windows count
  const totalWindows = useMemo(() => {
    if (!currentMode) return 0;
    return currentMode.sliders.reduce((sum, slider) => sum + slider.windows.length, 0);
  }, [currentMode]);

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="dsp-controls-loading">
        <div className="spinner"></div>
        <p>⏳ Loading custom bands...</p>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="dsp-controls-error">
        <p className="error-message">❌ {error}</p>
        <button 
          onClick={() => handleModeSelect(AVAILABLE_CUSTOMIZED_MODES[0])}
          className="retry-button"
        >
          🔄 Retry
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
      {/* Info Banner */}
      <div className="dsp-info-banner">
        <p className="dsp-info-text">
          🎛️ Advanced frequency band control with multi-window EQ. Adjust individual frequency ranges 
          to sculpt your sound. Each slider can affect multiple frequency windows simultaneously.
        </p>
      </div>

      {/* Mode Header */}
      <div className="dsp-mode-header">
        <div className="dsp-mode-info">
          <h2 className="dsp-mode-title">
            <span className="dsp-mode-icon">{getModeIcon(currentModeId)}</span>
            {currentMode.name}
          </h2>
          <p className="dsp-mode-description">{currentMode.description}</p>
          <div className="dsp-mode-stats">
            <span className="stat-badge">
              <span className="stat-icon">🎚️</span>
              {currentMode.sliders.length} Bands
            </span>
            <span className="stat-badge">
              <span className="stat-icon">📊</span>
              {totalWindows} Windows
            </span>
            {hasModifications && (
              <span className="stat-badge modified">
                <span className="stat-icon">✏️</span>
                Modified
              </span>
            )}
          </div>
        </div>
        
        <div className="dsp-mode-actions">
          {/* Mode Selector Dropdown */}
          <div className="mode-selector-wrapper">
            <label className="mode-selector-label">Preset:</label>
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
          </div>
          
          {/* Reset Button */}
          <button 
            onClick={handleReset} 
            disabled={disabled || !hasModifications} 
            className="dsp-reset-button"
            aria-label="Reset all sliders to default values"
            title={hasModifications ? 'Reset all bands to defaults' : 'No changes to reset'}
          >
            ↻ Reset
          </button>
        </div>
      </div>

      {/* Sliders Container */}
      <fieldset disabled={disabled} className="dsp-sliders-container">
        <legend className="sr-only">EQ Band Controls</legend>
        <div className="sliders-grid">
          {currentMode.sliders.map((slider, index) => (
            <MultiWindowSlider
              key={slider.id}
              slider={slider}
              value={sliderScales[slider.id] ?? slider.defaultScale}
              onChange={(value) => handleSliderChange(slider.id, value)}
              index={index}
            />
          ))}
        </div>
      </fieldset>

      {/* Quick Actions */}
      <div className="dsp-quick-actions">
        <button 
          className="quick-action-btn"
          onClick={() => {
            // Set all to mute (0)
            if (!currentMode) return;
            const muteScales: Record<string, number> = {};
            currentMode.sliders.forEach(s => muteScales[s.id] = 0);
            setSliderScales(muteScales);
            const scalesMap = new Map(Object.entries(muteScales));
            onBandSpecsChange(buildBandSpecsFromSliders(currentMode.sliders, scalesMap));
          }}
          disabled={disabled}
          title="Mute all bands"
        >
          🔇 Mute All
        </button>
        <button 
          className="quick-action-btn"
          onClick={() => {
            // Set all to unity (1)
            if (!currentMode) return;
            const unityScales: Record<string, number> = {};
            currentMode.sliders.forEach(s => unityScales[s.id] = 1);
            setSliderScales(unityScales);
            const scalesMap = new Map(Object.entries(unityScales));
            onBandSpecsChange(buildBandSpecsFromSliders(currentMode.sliders, scalesMap));
          }}
          disabled={disabled}
          title="Set all bands to unity gain"
        >
          ⚖️ Unity All
        </button>
        <button 
          className="quick-action-btn"
          onClick={() => {
            // Set all to max (2)
            if (!currentMode) return;
            const maxScales: Record<string, number> = {};
            currentMode.sliders.forEach(s => maxScales[s.id] = 2);
            setSliderScales(maxScales);
            const scalesMap = new Map(Object.entries(maxScales));
            onBandSpecsChange(buildBandSpecsFromSliders(currentMode.sliders, scalesMap));
          }}
          disabled={disabled}
          title="Maximize all bands"
        >
          🔊 Max All
        </button>
      </div>
    </div>
  );
}

/**
 * MultiWindowSlider - Enhanced slider component for multi-window frequency bands
 */
interface MultiWindowSliderProps {
  slider: SliderSpec;
  value: number;
  onChange: (value: number) => void;
  index: number;
}

function MultiWindowSlider({ slider, value, onChange, index }: MultiWindowSliderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const windowsText = slider.windows
    .map(w => `${Math.round(w.f_start_hz)}-${Math.round(w.f_end_hz)} Hz`)
    .join(', ');

  // Calculate overall frequency range
  const minFreq = Math.min(...slider.windows.map(w => w.f_start_hz));
  const maxFreq = Math.max(...slider.windows.map(w => w.f_end_hz));
  
  // Determine visual state based on value
  const getValueState = () => {
    if (value === 0) return 'muted';
    if (value < 0.5) return 'reduced';
    if (value < 0.95 || value > 1.05) return 'modified';
    if (value > 1.5) return 'boosted';
    return 'unity';
  };
  
  const valueState = getValueState();
  const icon = getFrequencyIcon(slider.label);

  return (
    <div 
      className={`dsp-slider-card ${valueState}`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Card Header */}
      <div className="dsp-slider-header">
        <div className="dsp-slider-title">
          <span className="dsp-slider-icon">{icon}</span>
          <label htmlFor={`slider-${slider.id}`} className="dsp-slider-label">
            {slider.label}
          </label>
        </div>
        <div className="dsp-slider-meta">
          <span 
            className="dsp-windows-badge" 
            title={`Frequency ranges: ${windowsText}`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {slider.windows.length} {slider.windows.length === 1 ? 'band' : 'bands'}
          </span>
          <span className={`dsp-scale-value ${valueState}`}>
            {value.toFixed(2)}×
          </span>
        </div>
      </div>

      {/* Frequency Range Indicator */}
      <div className="dsp-freq-range">
        <span className="freq-min">{formatFrequency(minFreq)}</span>
        <div className="freq-bar">
          <div 
            className="freq-bar-fill"
            style={{ 
              left: `${Math.log10(minFreq / 20) / Math.log10(20000 / 20) * 100}%`,
              width: `${(Math.log10(maxFreq / 20) - Math.log10(minFreq / 20)) / Math.log10(20000 / 20) * 100}%`
            }}
          />
        </div>
        <span className="freq-max">{formatFrequency(maxFreq)}</span>
      </div>
      
      {/* Slider Control */}
      <div className="dsp-slider-control">
        <input
          id={`slider-${slider.id}`}
          type="range"
          min="0"
          max="2"
          step="0.01"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="dsp-range-input"
          aria-label={`${slider.label} gain control`}
          aria-valuemin={0}
          aria-valuemax={2}
          aria-valuenow={value}
          aria-valuetext={`${value.toFixed(2)} times`}
        />
        <div className="dsp-slider-ticks">
          <span className="tick mute">0×</span>
          <span className="tick unity">1×</span>
          <span className="tick max">2×</span>
        </div>
      </div>

      {/* Quick Preset Buttons */}
      <div className="dsp-slider-presets">
        <button 
          className={`preset-btn ${value === 0 ? 'active' : ''}`}
          onClick={() => onChange(0)}
          title="Mute"
        >
          🔇
        </button>
        <button 
          className={`preset-btn ${value === 0.5 ? 'active' : ''}`}
          onClick={() => onChange(0.5)}
          title="Half"
        >
          ½
        </button>
        <button 
          className={`preset-btn ${value === 1 ? 'active' : ''}`}
          onClick={() => onChange(1)}
          title="Unity"
        >
          1×
        </button>
        <button 
          className={`preset-btn ${value === 1.5 ? 'active' : ''}`}
          onClick={() => onChange(1.5)}
          title="Boost 1.5x"
        >
          1.5×
        </button>
        <button 
          className={`preset-btn ${value === 2 ? 'active' : ''}`}
          onClick={() => onChange(2)}
          title="Double"
        >
          2×
        </button>
      </div>

      {/* Expandable Window Details */}
      {isExpanded && (
        <div className="dsp-windows-expanded">
          <div className="windows-title">Frequency Windows:</div>
          <ul className="dsp-windows-list">
            {slider.windows.map((window, idx) => (
              <li key={idx} className="dsp-window-item">
                <span className="window-icon">📊</span>
                <span className="window-range">
                  {formatFrequency(window.f_start_hz)} → {formatFrequency(window.f_end_hz)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Format frequency value for display
 */
function formatFrequency(freq: number): string {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(freq >= 10000 ? 0 : 1)}k`;
  }
  return `${Math.round(freq)}`;
}

