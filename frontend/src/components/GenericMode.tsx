/**
 * Generic Mode: User-defined frequency subdivisions with linear gain [0.0 - 2.0]
 * TICKET 3: Uses local staging to prevent processing loops during typing
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { BandSpec } from '../model/types';
import './GenericMode.css';

interface GenericBand {
  id: string;
  startHz: number;
  endHz: number;
  scale: number; // Linear gain [0.0 - 2.0]
}

// Local editing state for frequency inputs (prevents processing on each keystroke)
interface FreqEditState {
  bandId: string;
  field: 'startHz' | 'endHz';
  value: string;
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
  
  // TICKET 3: Local staging for frequency inputs to prevent processing on each keystroke
  const [freqEdits, setFreqEdits] = useState<Record<string, FreqEditState>>({});
  
  // Track the last committed bands to avoid redundant processing
  const lastCommittedRef = useRef<string>('');
  
  // Debounce timer ref for auto-commit
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nyquist = sampleRate / 2;
  
  // Helper to check if processing should be triggered
  // Skip if all bands have unity gain (no actual EQ effect)
  const shouldTriggerProcessing = useCallback((bandsToCheck: GenericBand[]): boolean => {
    // Always process if any band has non-unity gain
    return bandsToCheck.some(b => Math.abs(b.scale - 1.0) > 0.001);
  }, []);
  
  // Commit bands to parent (triggers processing)
  const commitBands = useCallback((updatedBands: GenericBand[], forceProcess = false) => {
    const serialized = JSON.stringify(updatedBands.map(b => ({
      startHz: b.startHz,
      endHz: b.endHz,
      scale: b.scale,
    })));
    
    // Skip if nothing changed
    if (serialized === lastCommittedRef.current && !forceProcess) {
      return;
    }
    
    // Skip processing if all bands are at unity gain (no effect)
    if (!forceProcess && !shouldTriggerProcessing(updatedBands)) {
      lastCommittedRef.current = serialized;
      return;
    }
    
    lastCommittedRef.current = serialized;
    onBandsChange(updatedBands);
  }, [onBandsChange, shouldTriggerProcessing]);

  // Add band WITHOUT triggering processing (new bands have unity gain = no effect)
  const addBand = () => {
    const newBand: GenericBand = {
      id: Date.now().toString(),
      startHz: 1000,
      endHz: 2000,
      scale: 1.0, // Unity gain - no processing needed
    };
    const updatedBands = [...bands, newBand];
    setBands(updatedBands);
    // Don't call onBandsChange - new band at unity gain has no effect
    // User must adjust gain to trigger processing
  };

  const deleteBand = (id: string) => {
    const updatedBands = bands.filter(b => b.id !== id);
    setBands(updatedBands);
    // Deleting a band can change the output, so commit
    commitBands(updatedBands, true);
  };

  // Update band with staging for frequency fields
  const updateBand = (id: string, field: keyof GenericBand, value: number) => {
    // Validate and clamp values
    let clampedValue = value;
    
    if (field === 'startHz' || field === 'endHz') {
      clampedValue = Math.max(0, Math.min(nyquist, value));
    } else if (field === 'scale') {
      clampedValue = Math.max(0, Math.min(2, value));
    }
    
    const updatedBands = bands.map(b =>
      b.id === id ? { ...b, [field]: clampedValue } : b
    );
    setBands(updatedBands);
    
    // For gain changes, commit immediately (this is what affects the audio)
    if (field === 'scale') {
      commitBands(updatedBands);
    }
    // For frequency changes, use debounced commit (user might still be typing)
    else {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        commitBands(updatedBands);
      }, 600); // 600ms debounce for frequency typing
    }
  };
  
  // Handle frequency input change (staged, doesn't trigger processing)
  const handleFreqInputChange = (bandId: string, field: 'startHz' | 'endHz', rawValue: string) => {
    const editKey = `${bandId}-${field}`;
    setFreqEdits(prev => ({
      ...prev,
      [editKey]: { bandId, field, value: rawValue },
    }));
  };
  
  // Commit frequency edit on blur or Enter
  const commitFreqEdit = (bandId: string, field: 'startHz' | 'endHz') => {
    const editKey = `${bandId}-${field}`;
    const edit = freqEdits[editKey];
    
    if (edit) {
      const numValue = parseFloat(edit.value) || 0;
      updateBand(bandId, field, numValue);
      
      // Clear the edit state
      setFreqEdits(prev => {
        const next = { ...prev };
        delete next[editKey];
        return next;
      });
    }
  };
  
  // Get the display value for frequency input (edited value or actual value)
  const getFreqInputValue = (bandId: string, field: 'startHz' | 'endHz', actualValue: number): string => {
    const editKey = `${bandId}-${field}`;
    const edit = freqEdits[editKey];
    return edit ? edit.value : actualValue.toString();
  };
  
  // Check if a frequency field is being edited
  const isFreqEditing = (bandId: string, field: 'startHz' | 'endHz'): boolean => {
    const editKey = `${bandId}-${field}`;
    return editKey in freqEdits;
  };
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);
  
  // Apply frequency preset (both start and end at once, single commit)
  const applyFreqPreset = (id: string, startHz: number, endHz: number) => {
    const clampedStart = Math.max(0, Math.min(nyquist, startHz));
    const clampedEnd = Math.max(0, Math.min(nyquist, endHz));
    
    const updatedBands = bands.map(b =>
      b.id === id ? { ...b, startHz: clampedStart, endHz: clampedEnd } : b
    );
    setBands(updatedBands);
    commitBands(updatedBands);
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
    <div className="generic-mode compact">
      {/* Compact Header */}
      <div className="generic-mode-header compact">
        <div className="header-left">
          <div className="header-title">
            <span className="header-icon">🎛️</span>
            <h2>Generic Bands</h2>
            <span className="band-count-inline">{bands.length} bands</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="action-btn primary compact" 
            onClick={addBand} 
            disabled={disabled}
            title="Add new band"
          >
            <span className="btn-icon">➕</span>
          </button>
          <button 
            className="action-btn secondary compact" 
            onClick={exportScheme} 
            disabled={disabled || bands.length === 0}
            title="Export scheme"
          >
            <span className="btn-icon">💾</span>
          </button>
          <label className="action-btn secondary compact import-label" title="Import scheme">
            <span className="btn-icon">📂</span>
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

      {/* Horizontal Scrolling Bands Container */}
      <div className="bands-scroll-container">
        <div className="bands-scroll-track">
          {bands.map((band, index) => {
            const isExpanded = expandedBand === band.id;
            const gainStatus = getGainStatus(band.scale);
            const bandIcon = getBandIcon(band.startHz, band.endHz);
            const gainColor = getGainColor(band.scale);
            
            return (
              <div 
                key={band.id} 
                className={`band-card-compact ${gainStatus.className} ${isExpanded ? 'expanded' : ''} ${disabled ? 'disabled' : ''}`}
              >
                {/* Compact Card Header */}
                <div className="band-card-top">
                  <span className="band-icon-compact">{bandIcon}</span>
                  <span className="band-number">#{index + 1}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBand(band.id);
                    }}
                    disabled={bands.length === 1 || disabled}
                    className="delete-btn-compact"
                    title="Delete band"
                  >
                    ×
                  </button>
                </div>

                {/* Frequency Range Display */}
                <div 
                  className="band-freq-display"
                  onClick={() => setExpandedBand(isExpanded ? null : band.id)}
                >
                  <span className="freq-value">{band.startHz.toLocaleString()}</span>
                  <span className="freq-separator">–</span>
                  <span className="freq-value">{band.endHz.toLocaleString()}</span>
                  <span className="freq-unit">Hz</span>
                </div>

                {/* Vertical Gain Slider */}
                <div className="gain-control-vertical">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={band.scale}
                    onChange={(e) => updateBand(band.id, 'scale', parseFloat(e.target.value))}
                    disabled={disabled}
                    className="gain-slider-vertical"
                    style={{
                      background: `linear-gradient(to top, ${gainColor} ${(band.scale / 2) * 100}%, rgba(255,255,255,0.1) ${(band.scale / 2) * 100}%)`
                    }}
                  />
                </div>

                {/* Gain Value Display */}
                <div className="gain-display" style={{ color: gainColor }}>
                  <span className="gain-value-large">{band.scale.toFixed(2)}</span>
                  <span className="gain-unit">×</span>
                </div>

                {/* Status Badge */}
                <span className={`status-badge-compact ${gainStatus.className}`}>
                  {gainStatus.label}
                </span>

                {/* Expanded Frequency Editor */}
                {isExpanded && (
                  <div className="freq-editor-popup">
                    <div className="freq-editor-row">
                      <label>
                        <span>Start</span>
                        <input
                          type="number"
                          min="0"
                          max={nyquist}
                          value={getFreqInputValue(band.id, 'startHz', band.startHz)}
                          onChange={(e) => handleFreqInputChange(band.id, 'startHz', e.target.value)}
                          onBlur={() => commitFreqEdit(band.id, 'startHz')}
                          onKeyDown={(e) => e.key === 'Enter' && commitFreqEdit(band.id, 'startHz')}
                          disabled={disabled}
                          className={isFreqEditing(band.id, 'startHz') ? 'editing' : ''}
                        />
                      </label>
                      <label>
                        <span>End</span>
                        <input
                          type="number"
                          min="0"
                          max={nyquist}
                          value={getFreqInputValue(band.id, 'endHz', band.endHz)}
                          onChange={(e) => handleFreqInputChange(band.id, 'endHz', e.target.value)}
                          onBlur={() => commitFreqEdit(band.id, 'endHz')}
                          onKeyDown={(e) => e.key === 'Enter' && commitFreqEdit(band.id, 'endHz')}
                          disabled={disabled}
                          className={isFreqEditing(band.id, 'endHz') ? 'editing' : ''}
                        />
                      </label>
                    </div>
                    <div className="freq-presets-compact">
                      <button onClick={() => applyFreqPreset(band.id, 20, 200)} disabled={disabled}>Sub</button>
                      <button onClick={() => applyFreqPreset(band.id, 200, 800)} disabled={disabled}>Bass</button>
                      <button onClick={() => applyFreqPreset(band.id, 800, 2500)} disabled={disabled}>Mid</button>
                      <button onClick={() => applyFreqPreset(band.id, 2500, 8000)} disabled={disabled}>High</button>
                      <button onClick={() => applyFreqPreset(band.id, 8000, 20000)} disabled={disabled}>Air</button>
                    </div>
                    <div className="gain-presets-compact">
                      <button onClick={() => updateBand(band.id, 'scale', 0)} disabled={disabled}>Mute</button>
                      <button onClick={() => updateBand(band.id, 'scale', 0.5)} disabled={disabled}>-6dB</button>
                      <button onClick={() => updateBand(band.id, 'scale', 1)} disabled={disabled}>Unity</button>
                      <button onClick={() => updateBand(band.id, 'scale', 1.5)} disabled={disabled}>+3dB</button>
                      <button onClick={() => updateBand(band.id, 'scale', 2)} disabled={disabled}>Max</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Add Band Placeholder */}
          <button 
            className="add-band-placeholder"
            onClick={addBand}
            disabled={disabled}
          >
            <span className="add-icon">+</span>
            <span>Add Band</span>
          </button>
        </div>
      </div>

      {/* Scroll Hint */}
      {bands.length > 3 && (
        <div className="scroll-hint">
          <span>← Scroll horizontally to see all bands →</span>
        </div>
      )}
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
