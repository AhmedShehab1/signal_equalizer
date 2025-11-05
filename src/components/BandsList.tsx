/**
 * Component for displaying and controlling equalizer bands
 */

import { FrequencyBand } from '../model/types';

interface BandsListProps {
  bands: FrequencyBand[];
  onBandChange: (bandId: string, gain: number) => void;
}

export default function BandsList({ bands, onBandChange }: BandsListProps) {
  const handleSliderChange = (bandId: string, value: string) => {
    const gain = parseFloat(value);
    onBandChange(bandId, gain);
  };

  return (
    <div className="bands-list">
      <h3>Equalizer Bands</h3>
      <div className="bands-container">
        {bands.map(band => (
          <div key={band.id} className="band-control">
            <label htmlFor={`band-${band.id}`}>
              {band.label}
              <br />
              <small>{band.frequency} Hz</small>
            </label>
            <input
              id={`band-${band.id}`}
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={band.gain}
              onChange={(e) => handleSliderChange(band.id, e.target.value)}
              orient="vertical"
            />
            <span className="gain-value">{band.gain.toFixed(1)} dB</span>
          </div>
        ))}
      </div>
    </div>
  );
}
