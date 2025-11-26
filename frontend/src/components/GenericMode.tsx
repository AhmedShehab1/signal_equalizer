/**
 * Generic Mode: User-defined frequency subdivisions with linear gain [0.0 - 2.0]
 */

import { useState } from 'react';
import { BandSpec } from '../model/types';
import './GenericMode.css';

interface GenericBand {
  id: string;
  startHz: number;
  endHz: number;
  scale: number; // Linear gain [0.0 - 2.0]
}

interface GenericModeProps {
  onBandsChange: (bands: GenericBand[]) => void;
  sampleRate: number;
  disabled?: boolean;
}

// Get icon based on frequency range
const getBandIcon = (startHz: number, endHz: number): string => {
  const midFreq = (startHz + endHz) / 2;
  if (midFreq < 100) return '🎵'; // Sub-bass
  if (midFreq < 300) return '🔊'; // Bass
  if (midFreq < 1000) return '🎸'; // Low mids
  if (midFreq < 4000) return '🎹'; // Mids
  if (midFreq < 8000) return '🎤'; // Upper mids
  return '✨'; // Highs/Air
};

// Get color based on gain
const getGainColor = (scale: number): string => {
  if (scale < 0.3) return '#ff4757'; // Muted - red
  if (scale < 0.7) return '#ffa502'; // Reduced - orange
  if (scale < 1.3) return '#2ed573'; // Unity - green
  if (scale < 1.7) return '#1e90ff'; // Boosted - blue
  return '#a55eea'; // Max boost - purple
};

// Get status label
const getGainStatus = (scale: number): { label: string; className: string } => {
  if (scale < 0.1) return { label: 'MUTED', className: 'muted' };
  if (scale < 0.5) return { label: 'CUT', className: 'cut' };
  if (scale < 0.95) return { label: 'REDUCED', className: 'reduced' };
  if (scale <= 1.05) return { label: 'UNITY', className: 'unity' };
  if (scale < 1.5) return { label: 'BOOST', className: 'boost' };
  return { label: 'MAX', className: 'max' };
};

export default function GenericMode({ onBandsChange, sampleRate, disabled = false }: GenericModeProps) {
  const [bands, setBands] = useState<GenericBand[]>([
    { id: '1', startHz: 20, endHz: 200, scale: 1.0 },
  ]);
  const [expandedBand, setExpandedBand] = useState<string | null>(null);

  const nyquist = sampleRate / 2;

  const addBand = () => {
    const newBand: GenericBand = {
      id: Date.now().toString(),
      startHz: 1000,
      endHz: 2000,
      scale: 1.0,
    };
    const updatedBands = [...bands, newBand];
    setBands(updatedBands);
    onBandsChange(updatedBands);
  };

  const deleteBand = (id: string) => {
    const updatedBands = bands.filter(b => b.id !== id);
    setBands(updatedBands);
    onBandsChange(updatedBands);
  };

  const updateBand = (id: string, field: keyof GenericBand, value: number) => {
    // Validate and clamp values
    let clampedValue = value;
    
    if (field === 'startHz' || field === 'endHz') {
      // Clamp frequency to [0, nyquist]
      clampedValue = Math.max(0, Math.min(nyquist, value));
    } else if (field === 'scale') {
      // Clamp scale to [0, 2]
      clampedValue = Math.max(0, Math.min(2, value));
    }
    
    const updatedBands = bands.map(b =>
      b.id === id ? { ...b, [field]: clampedValue } : b
    );
    setBands(updatedBands);
    onBandsChange(updatedBands);
  };

  const exportScheme = () => {
    const scheme = {
      name: 'Custom Generic Mode',
      description: 'User-defined frequency subdivisions',
      sampleRate,
      bands: bands.map(b => ({
        startHz: b.startHz,
        endHz: b.endHz,
        scale: b.scale,
      })),
    };

    const blob = new Blob([JSON.stringify(scheme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generic-mode-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importScheme = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const scheme = JSON.parse(e.target?.result as string);
        if (!scheme.bands || !Array.isArray(scheme.bands)) {
          throw new Error('Invalid scheme format: missing or invalid "bands" array');
        }

        const validatedBands: GenericBand[] = [];
        const errors: string[] = [];

        scheme.bands.forEach((b: any, idx: number) => {
          const bandNum = idx + 1;
          
          // Parse and validate values
          let startHz = Number(b.startHz);
          let endHz = Number(b.endHz);
          let scale = Number(b.scale);

          // Check for NaN values
          if (isNaN(startHz) || isNaN(endHz) || isNaN(scale)) {
            errors.push(`Band ${bandNum}: Invalid numeric values (startHz: ${b.startHz}, endHz: ${b.endHz}, scale: ${b.scale})`);
            return;
          }

          // Clamp frequencies to [0, nyquist]
          const originalStart = startHz;
          const originalEnd = endHz;
          startHz = Math.max(0, Math.min(nyquist, startHz));
          endHz = Math.max(0, Math.min(nyquist, endHz));

          if (originalStart !== startHz || originalEnd !== endHz) {
            console.warn(`Band ${bandNum}: Frequencies clamped to valid range [0, ${nyquist}]`);
          }

          // Clamp scale to [0, 2]
          const originalScale = scale;
          scale = Math.max(0, Math.min(2, scale));
          
          if (originalScale !== scale) {
            console.warn(`Band ${bandNum}: Scale clamped to valid range [0, 2]`);
          }

          // Validate startHz < endHz
          if (startHz >= endHz) {
            // Auto-fix: swap if both are valid, otherwise use sensible defaults
            if (startHz > 0 && endHz > 0) {
              [startHz, endHz] = [endHz, startHz];
              console.warn(`Band ${bandNum}: Start and end frequencies swapped (start was >= end)`);
            } else {
              errors.push(`Band ${bandNum}: Invalid range (start: ${startHz} Hz, end: ${endHz} Hz). Start must be less than end.`);
              return;
            }
          }

          // Additional validation: ensure meaningful range
          if (endHz - startHz < 1) {
            errors.push(`Band ${bandNum}: Range too narrow (${startHz}-${endHz} Hz). Minimum 1 Hz width required.`);
            return;
          }

          validatedBands.push({
            id: `imported-${Date.now()}-${idx}`,
            startHz,
            endHz,
            scale,
          });
        });

        // Check if we have any valid bands
        if (validatedBands.length === 0) {
          throw new Error(
            'No valid bands found in scheme.\n\n' +
            'Errors:\n' + errors.join('\n')
          );
        }

        // Show warnings if some bands were rejected
        if (errors.length > 0) {
          const message = 
            `Imported ${validatedBands.length} valid band(s). ` +
            `${errors.length} band(s) rejected:\n\n` +
            errors.join('\n');
          alert(message);
        }

        setBands(validatedBands);
        onBandsChange(validatedBands);
        
      } catch (error) {
        alert('Failed to import scheme: ' + (error instanceof Error ? error.message : 'Invalid JSON'));
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  return (
    <div className="generic-mode">
      {/* Header Section */}
      <div className="generic-mode-header">
        <div className="header-left">
          <div className="header-title">
            <span className="header-icon">🎛️</span>
            <h2>Custom Band Editor</h2>
          </div>
          <p className="header-description">
            Define custom frequency bands with precise control over gain. Perfect for surgical EQ adjustments.
          </p>
        </div>
        
        <div className="header-right">
          <div className="band-count">
            <span className="count-number">{bands.length}</span>
            <span className="count-label">Active Bands</span>
          </div>
          
          <div className="header-actions">
            <button 
              className="action-btn primary" 
              onClick={addBand} 
              disabled={disabled}
            >
              <span className="btn-icon">➕</span>
              <span className="btn-text">Add Band</span>
            </button>
            <button 
              className="action-btn secondary" 
              onClick={exportScheme} 
              disabled={disabled || bands.length === 0}
            >
              <span className="btn-icon">💾</span>
              <span className="btn-text">Export</span>
            </button>
            <label className="action-btn secondary import-label">
              <span className="btn-icon">📂</span>
              <span className="btn-text">Import</span>
              <input
                type="file"
                accept=".json"
                onChange={importScheme}
                disabled={disabled}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="info-banner">
        <span className="info-icon">💡</span>
        <p>
          <strong>Tip:</strong> Click on a band card to expand frequency controls. 
          Use the slider to adjust gain from 0× (mute) to 2× (double).
        </p>
      </div>

      {/* Bands Grid */}
      <div className="bands-grid">
        {bands.map((band, index) => {
          const isExpanded = expandedBand === band.id;
          const gainStatus = getGainStatus(band.scale);
          const bandIcon = getBandIcon(band.startHz, band.endHz);
          const gainColor = getGainColor(band.scale);
          const freqWidth = ((band.endHz - band.startHz) / nyquist) * 100;
          const freqStart = (band.startHz / nyquist) * 100;
          
          return (
            <div 
              key={band.id} 
              className={`band-card ${gainStatus.className} ${isExpanded ? 'expanded' : ''} ${disabled ? 'disabled' : ''}`}
            >
              {/* Band Header */}
              <div 
                className="band-card-header"
                onClick={() => setExpandedBand(isExpanded ? null : band.id)}
              >
                <div className="band-identity">
                  <span className="band-icon">{bandIcon}</span>
                  <div className="band-info">
                    <h4 className="band-name">Band {index + 1}</h4>
                    <span className="band-range">
                      {band.startHz.toLocaleString()} – {band.endHz.toLocaleString()} Hz
                    </span>
                  </div>
                </div>
                
                <div className="band-status">
                  <span className={`status-badge ${gainStatus.className}`}>
                    {gainStatus.label}
                  </span>
                  <span className="gain-value" style={{ color: gainColor }}>
                    {band.scale.toFixed(2)}×
                  </span>
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteBand(band.id);
                  }}
                  disabled={bands.length === 1 || disabled}
                  className="delete-btn"
                  aria-label={`Delete band ${index + 1}`}
                  title="Delete band"
                >
                  🗑️
                </button>
              </div>

              {/* Visual Frequency Bar */}
              <div className="freq-visualizer">
                <div className="freq-bar-bg">
                  <div 
                    className="freq-bar-fill"
                    style={{ 
                      left: `${freqStart}%`,
                      width: `${Math.max(freqWidth, 2)}%`,
                      background: `linear-gradient(90deg, ${gainColor}88, ${gainColor})`
                    }}
                  />
                </div>
                <div className="freq-scale">
                  <span>20</span>
                  <span>100</span>
                  <span>1k</span>
                  <span>10k</span>
                  <span>20k</span>
                </div>
              </div>

              {/* Gain Slider */}
              <div className="gain-control">
                <div className="gain-header">
                  <span className="gain-label">Gain</span>
                  <div className="gain-presets">
                    <button 
                      className={`preset-btn ${band.scale === 0 ? 'active' : ''}`}
                      onClick={() => updateBand(band.id, 'scale', 0)}
                      disabled={disabled}
                    >
                      Mute
                    </button>
                    <button 
                      className={`preset-btn ${band.scale === 0.5 ? 'active' : ''}`}
                      onClick={() => updateBand(band.id, 'scale', 0.5)}
                      disabled={disabled}
                    >
                      -6dB
                    </button>
                    <button 
                      className={`preset-btn ${band.scale === 1 ? 'active' : ''}`}
                      onClick={() => updateBand(band.id, 'scale', 1)}
                      disabled={disabled}
                    >
                      Unity
                    </button>
                    <button 
                      className={`preset-btn ${band.scale === 1.5 ? 'active' : ''}`}
                      onClick={() => updateBand(band.id, 'scale', 1.5)}
                      disabled={disabled}
                    >
                      +3dB
                    </button>
                    <button 
                      className={`preset-btn ${band.scale === 2 ? 'active' : ''}`}
                      onClick={() => updateBand(band.id, 'scale', 2)}
                      disabled={disabled}
                    >
                      +6dB
                    </button>
                  </div>
                </div>
                
                <div className="slider-wrapper">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={band.scale}
                    onChange={(e) => updateBand(band.id, 'scale', parseFloat(e.target.value))}
                    disabled={disabled}
                    className="gain-slider"
                    style={{
                      background: `linear-gradient(90deg, ${gainColor} ${(band.scale / 2) * 100}%, rgba(255,255,255,0.1) ${(band.scale / 2) * 100}%)`
                    }}
                  />
                  <div className="slider-ticks">
                    <span className="tick muted">0×</span>
                    <span className="tick">0.5×</span>
                    <span className="tick unity">1×</span>
                    <span className="tick">1.5×</span>
                    <span className="tick boost">2×</span>
                  </div>
                </div>
              </div>

              {/* Expanded Frequency Controls */}
              {isExpanded && (
                <div className="freq-controls">
                  <div className="freq-input-group">
                    <label>
                      <span className="input-label">
                        <span className="input-icon">📉</span>
                        Start Frequency
                      </span>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          min="0"
                          max={nyquist}
                          step="1"
                          value={band.startHz}
                          onChange={(e) => updateBand(band.id, 'startHz', parseFloat(e.target.value) || 0)}
                          disabled={disabled}
                          className="freq-input"
                        />
                        <span className="input-unit">Hz</span>
                      </div>
                    </label>
                    
                    <div className="freq-arrow">→</div>
                    
                    <label>
                      <span className="input-label">
                        <span className="input-icon">📈</span>
                        End Frequency
                      </span>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          min="0"
                          max={nyquist}
                          step="1"
                          value={band.endHz}
                          onChange={(e) => updateBand(band.id, 'endHz', parseFloat(e.target.value) || 0)}
                          disabled={disabled}
                          className="freq-input"
                        />
                        <span className="input-unit">Hz</span>
                      </div>
                    </label>
                  </div>
                  
                  <div className="freq-presets">
                    <span className="presets-label">Quick Ranges:</span>
                    <button 
                      className="range-preset"
                      onClick={() => {
                        updateBand(band.id, 'startHz', 20);
                        updateBand(band.id, 'endHz', 200);
                      }}
                      disabled={disabled}
                    >
                      Sub-Bass
                    </button>
                    <button 
                      className="range-preset"
                      onClick={() => {
                        updateBand(band.id, 'startHz', 200);
                        updateBand(band.id, 'endHz', 800);
                      }}
                      disabled={disabled}
                    >
                      Bass
                    </button>
                    <button 
                      className="range-preset"
                      onClick={() => {
                        updateBand(band.id, 'startHz', 800);
                        updateBand(band.id, 'endHz', 2500);
                      }}
                      disabled={disabled}
                    >
                      Mids
                    </button>
                    <button 
                      className="range-preset"
                      onClick={() => {
                        updateBand(band.id, 'startHz', 2500);
                        updateBand(band.id, 'endHz', 8000);
                      }}
                      disabled={disabled}
                    >
                      Presence
                    </button>
                    <button 
                      className="range-preset"
                      onClick={() => {
                        updateBand(band.id, 'startHz', 8000);
                        updateBand(band.id, 'endHz', 20000);
                      }}
                      disabled={disabled}
                    >
                      Highs
                    </button>
                  </div>
                </div>
              )}
              
              {/* Expand indicator */}
              <div className="expand-indicator" onClick={() => setExpandedBand(isExpanded ? null : band.id)}>
                <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▼</span>
                <span className="expand-text">{isExpanded ? 'Collapse' : 'Expand frequency controls'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Tips */}
      <div className="quick-tips">
        <div className="tip">
          <span className="tip-icon">🎯</span>
          <span>Click band header to expand/collapse frequency controls</span>
        </div>
        <div className="tip">
          <span className="tip-icon">⌨️</span>
          <span>Use presets for common frequency ranges</span>
        </div>
        <div className="tip">
          <span className="tip-icon">💾</span>
          <span>Export your setup to reuse later</span>
        </div>
      </div>
    </div>
  );
}

// Helper to convert GenericBand[] to BandSpec[]
export function genericBandsToBandSpecs(bands: GenericBand[]): BandSpec[] {
  return bands.map(b => ({
    scale: b.scale,
    windows: [{ f_start_hz: b.startHz, f_end_hz: b.endHz }],
  }));
}

export type { GenericBand };
