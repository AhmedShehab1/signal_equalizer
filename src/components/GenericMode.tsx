/**
 * Generic Mode: User-defined frequency subdivisions with linear gain [0.0 - 2.0]
 */

import { useState } from 'react';
import { BandSpec } from '../model/types';

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

export default function GenericMode({ onBandsChange, sampleRate, disabled = false }: GenericModeProps) {
  const [bands, setBands] = useState<GenericBand[]>([
    { id: '1', startHz: 20, endHz: 200, scale: 1.0 },
  ]);

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
          throw new Error('Invalid scheme format');
        }

        const importedBands: GenericBand[] = scheme.bands.map((b: any, idx: number) => ({
          id: `imported-${Date.now()}-${idx}`,
          startHz: Number(b.startHz) || 20,
          endHz: Number(b.endHz) || 200,
          scale: Number(b.scale) || 1.0,
        }));

        setBands(importedBands);
        onBandsChange(importedBands);
      } catch (error) {
        alert('Failed to import scheme: ' + (error instanceof Error ? error.message : 'Invalid JSON'));
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  return (
    <div className="generic-mode">
      <div className="generic-mode-header">
        <h2>Generic Mode (User-defined Subdivisions)</h2>
        <div className="generic-mode-actions">
          <button onClick={addBand} disabled={disabled}>
            + Add Band
          </button>
          <button onClick={exportScheme} disabled={disabled || bands.length === 0}>
            Export Scheme
          </button>
          <label className="import-button">
            Import Scheme
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

      <div className="generic-bands-list">
        {bands.map((band, index) => (
          <fieldset 
            key={band.id} 
            className="generic-band"
            disabled={disabled}
            style={{ border: '1px solid #333', borderRadius: '8px' }}
          >
            <div className="band-header">
              <h4>Band {index + 1}</h4>
              <button
                onClick={() => deleteBand(band.id)}
                disabled={bands.length === 1}
                className="delete-button"
                aria-label={`Delete band ${index + 1}`}
              >
                ✕
              </button>
            </div>

            <div className="band-controls">
              <div className="control-group">
                <label htmlFor={`start-${band.id}`}>
                  Start Frequency (Hz)
                  <input
                    id={`start-${band.id}`}
                    type="number"
                    min="0"
                    max={nyquist}
                    step="1"
                    value={band.startHz}
                    onChange={(e) => updateBand(band.id, 'startHz', parseFloat(e.target.value) || 0)}
                    aria-label={`Start frequency for band ${index + 1}`}
                    aria-describedby={`start-hint-${band.id}`}
                  />
                  <small id={`start-hint-${band.id}`} className="input-hint">
                    Range: 0 - {Math.round(nyquist)} Hz
                  </small>
                </label>
              </div>

              <div className="control-group">
                <label htmlFor={`end-${band.id}`}>
                  End Frequency (Hz)
                  <input
                    id={`end-${band.id}`}
                    type="number"
                    min="0"
                    max={nyquist}
                    step="1"
                    value={band.endHz}
                    onChange={(e) => updateBand(band.id, 'endHz', parseFloat(e.target.value) || 0)}
                    aria-label={`End frequency for band ${index + 1}`}
                    aria-describedby={`end-hint-${band.id}`}
                  />
                  <small id={`end-hint-${band.id}`} className="input-hint">
                    Range: 0 - {Math.round(nyquist)} Hz
                  </small>
                </label>
              </div>

              <div className="control-group scale-control">
                <label htmlFor={`scale-${band.id}`}>
                  Gain Scale (Linear)
                  <div className="slider-container">
                    <input
                      id={`scale-${band.id}`}
                      type="range"
                      min="0"
                      max="2"
                      step="0.01"
                      value={band.scale}
                      onChange={(e) => updateBand(band.id, 'scale', parseFloat(e.target.value))}
                      aria-label={`Gain scale for band ${index + 1}`}
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={band.scale}
                      aria-valuetext={`${band.scale.toFixed(2)} times`}
                    />
                    <span className="scale-value" aria-live="polite">
                      {band.scale.toFixed(2)}×
                    </span>
                  </div>
                  <div className="scale-labels">
                    <span>0.0× (mute)</span>
                    <span>1.0× (unity)</span>
                    <span>2.0× (double)</span>
                  </div>
                </label>
              </div>
            </div>
          </fieldset>
        ))}
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
