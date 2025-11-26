/**
 * Component for displaying and controlling equalizer bands
 */

import { FrequencyBand } from '../model/types';

interface BandsListProps {
  bands: FrequencyBand[];
  onBandChange: (id: string, gain: number) => void;
  disabled?: boolean;
}

export default function BandsList({ bands, onBandChange, disabled = false }: BandsListProps) {
  return (
    <div className="bands-list glass-panel">
      <div className="glass-panel-header">
        <h2>Equalizer Bands</h2>
        <span className="badge badge-primary">{bands.length} Bands</span>
      </div>
      <fieldset disabled={disabled} style={{ border: 'none', padding: 0, margin: 0 }}>
        {bands.map(band => (
          <div key={band.id} className="band">
            <label>
              {band.label} ({band.frequency} Hz)
              <input
                type="range"
                min="-12"
                max="12"
                step="0.1"
                value={band.gain}
                onChange={(e) => onBandChange(band.id, parseFloat(e.target.value))}
                aria-label={`${band.label} gain control`}
                aria-valuemin={-12}
                aria-valuemax={12}
                aria-valuenow={band.gain}
                aria-valuetext={`${band.gain.toFixed(1)} dB`}
              />
              <span aria-live="polite">{band.gain.toFixed(1)} dB</span>
            </label>
          </div>
        ))}
      </fieldset>
    </div>
  );
}

