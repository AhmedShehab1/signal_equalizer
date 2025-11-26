/**
 * Professional EQ Bands Panel - Vertical Fader Style
 * Compact band controls inspired by professional EQ plugins
 */

import { FrequencyBand } from '../model/types';
import './ProfessionalBandsPanel.css';

interface ProfessionalBandsPanelProps {
  bands: FrequencyBand[];
  onBandChange: (id: string, gain: number) => void;
  disabled?: boolean;
}

export default function ProfessionalBandsPanel({ 
  bands, 
  onBandChange, 
  disabled = false 
}: ProfessionalBandsPanelProps) {
  
  // Format frequency for display
  const formatFrequency = (freq: number): string => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(freq >= 10000 ? 0 : 1)}kHz`;
    }
    return `${freq}Hz`;
  };
  
  // Get color for frequency band
  const getBandColor = (frequency: number): string => {
    if (frequency < 200) return '#ff6b6b'; // Red - Bass
    if (frequency < 500) return '#ffa500'; // Orange - Low-mid
    if (frequency < 2000) return '#ffd700'; // Yellow - Mid
    if (frequency < 5000) return '#4ecdc4'; // Cyan - Upper-mid
    return '#a78bfa'; // Purple - Treble
  };
  
  return (
    <div className="professional-bands-panel glass-panel">
      <div className="bands-panel-header">
        <h3>EQ Bands</h3>
        <span className="badge badge-primary">{bands.length}</span>
      </div>
      
      <div className="bands-grid">
        {bands.map((band) => {
          const bandColor = getBandColor(band.frequency);
          const gainPercent = ((band.gain + 12) / 24) * 100; // Map -12 to +12 → 0 to 100%
          
          return (
            <div key={band.id} className="band-column">
              {/* Band enable/type buttons */}
              <div className="band-controls-top">
                <button 
                  className="btn btn-icon btn-ghost band-type-btn"
                  disabled={disabled}
                  title="Band type"
                  style={{ color: bandColor }}
                >
                  ∿
                </button>
                <button 
                  className="btn btn-icon btn-ghost band-enable-btn"
                  disabled={disabled}
                  title="Enable/disable band"
                >
                  ✓
                </button>
              </div>
              
              {/* Frequency display */}
              <div className="band-frequency" style={{ color: bandColor }}>
                {formatFrequency(band.frequency)}
              </div>
              
              {/* Vertical fader */}
              <div className="vertical-fader-container">
                <div className="fader-track">
                  {/* Gain indicators */}
                  <div className="fader-markers">
                    <span className="fader-mark">+12</span>
                    <span className="fader-mark center">0</span>
                    <span className="fader-mark">-12</span>
                  </div>
                  
                  {/* Center line (0dB) */}
                  <div className="fader-center-line"></div>
                  
                  {/* Fill indicator */}
                  <div 
                    className="fader-fill" 
                    style={{ 
                      height: `${Math.abs(50 - gainPercent)}%`,
                      bottom: `${Math.min(gainPercent, 50)}%`,
                      background: band.gain >= 0 
                        ? `linear-gradient(to top, ${bandColor}, ${bandColor}aa)` 
                        : `linear-gradient(to bottom, ${bandColor}, ${bandColor}aa)`
                    }}
                  ></div>
                  
                  {/* Slider input */}
                  <input
                    type="range"
                    className="vertical-fader"
                    min="-12"
                    max="12"
                    step="0.1"
                    value={band.gain}
                    onChange={(e) => onBandChange(band.id, parseFloat(e.target.value))}
                    disabled={disabled}
                    aria-label={`${band.label} gain control`}
                    aria-valuemin={-12}
                    aria-valuemax={12}
                    aria-valuenow={band.gain}
                    aria-valuetext={`${band.gain.toFixed(1)} dB`}
                    style={{
                      '--thumb-color': bandColor,
                    } as React.CSSProperties}
                  />
                </div>
              </div>
              
              {/* Gain value display */}
              <div 
                className={`band-gain-value ${band.gain >= 0 ? 'positive' : 'negative'}`}
                style={{ color: bandColor }}
              >
                {band.gain >= 0 ? '+' : ''}{band.gain.toFixed(1)}dB
              </div>
              
              {/* Rotary Q control */}
              <div className="rotary-control">
                <svg className="rotary-svg" viewBox="0 0 60 60">
                  {/* Background arc */}
                  <circle
                    cx="30"
                    cy="30"
                    r="24"
                    fill="none"
                    stroke="var(--color-gray-700)"
                    strokeWidth="3"
                  />
                  
                  {/* Value arc (placeholder - would be calculated based on Q) */}
                  <circle
                    cx="30"
                    cy="30"
                    r="24"
                    fill="none"
                    stroke={bandColor}
                    strokeWidth="3"
                    strokeDasharray="100 251"
                    strokeDashoffset="-25"
                    style={{ filter: `drop-shadow(0 0 4px ${bandColor})` }}
                  />
                  
                  {/* Center indicator */}
                  <circle
                    cx="30"
                    cy="30"
                    r="18"
                    fill="var(--glass-bg-medium)"
                    stroke={bandColor}
                    strokeWidth="2"
                  />
                  
                  {/* Pointer line */}
                  <line
                    x1="30"
                    y1="30"
                    x2="30"
                    y2="14"
                    stroke={bandColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="rotary-label">Q</span>
                <span className="rotary-value">1.0</span>
              </div>
              
              {/* Band label */}
              <div className="band-label">{band.label}</div>
              
              {/* Edit/Delete buttons */}
              <div className="band-controls-bottom">
                <button 
                  className="btn btn-icon btn-ghost"
                  disabled={disabled}
                  title="Edit band"
                >
                  ✎
                </button>
                <button 
                  className="btn btn-icon btn-ghost"
                  disabled={disabled}
                  title="Delete band"
                >
                  −
                </button>
              </div>
            </div>
          );
        })}
        
        {/* Add band button */}
        {bands.length < 10 && (
          <div className="band-column add-band-column">
            <button 
              className="btn btn-ghost add-band-btn"
              disabled={disabled}
              title="Add new band"
            >
              <span className="add-icon">+</span>
              <span className="add-label">Add Band</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
