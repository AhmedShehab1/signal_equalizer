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
    <div className="bands-list">
      <h2>Equalizer Bands</h2>
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
              disabled={disabled}
            />
            <span>{band.gain.toFixed(1)} dB</span>
          </label>
        </div>
      ))}
    </div>
  );
}

