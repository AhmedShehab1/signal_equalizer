import type { ChangeEvent, CSSProperties } from 'react';
import { FrequencyBand } from '../model/types';

type ChannelStripPanelProps = {
  bands: FrequencyBand[];
  onBandChange: (id: string, gain: number) => void;
  disabled?: boolean;
};

const STRIP_COLORS = ['#4ade80', '#facc15', '#fb923c', '#38bdf8', '#a78bfa', '#f472b6', '#34d399'];

export function ChannelStripPanel({ bands, onBandChange, disabled }: ChannelStripPanelProps) {
  if (bands.length === 0) {
    return (
      <aside className="channel-panel empty">
        <p className="channel-panel__empty">Load an audio file to unlock band controls.</p>
      </aside>
    );
  }

  return (
    <aside className="channel-panel" aria-label="Band controls">
      {bands.map((band, index) => (
        <ChannelStrip
          key={band.id}
          band={band}
          color={STRIP_COLORS[index % STRIP_COLORS.length]}
          onBandChange={onBandChange}
          disabled={disabled}
        />
      ))}
    </aside>
  );
}

interface ChannelStripProps {
  band: FrequencyBand;
  color: string;
  onBandChange: (id: string, gain: number) => void;
  disabled?: boolean;
}

function ChannelStrip({ band, color, onBandChange, disabled }: ChannelStripProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    onBandChange(band.id, value);
  };

  return (
    <div className="channel-strip" role="group" aria-label={`${band.label} band`}>
      <div className="channel-strip__indicator" style={{ background: color }}></div>
      <div className="channel-strip__freq">{formatFrequency(band.frequency)}</div>
      <div className="channel-strip__fader">
        <input
          type="range"
          min="-12"
          max="12"
          step="0.1"
          value={band.gain}
          onChange={handleChange}
          disabled={disabled}
          className="channel-strip__slider"
          aria-valuemin={-12}
          aria-valuemax={12}
          aria-valuenow={band.gain}
          aria-label={`${band.label} gain`}
          style={{ '--strip-color': color } as CSSProperties}
        />
        <div className="channel-strip__scale">
          <span>+12</span>
          <span>0</span>
          <span>-12</span>
        </div>
      </div>
      <div className="channel-strip__gain" style={{ color }}>
        {band.gain >= 0 ? '+' : ''}{band.gain.toFixed(1)} dB
      </div>
      <div className="channel-strip__knob">
        <div className="channel-strip__knob-face" style={{ borderColor: color }}>
          <span className="channel-strip__knob-pointer" style={{ background: color }}></span>
        </div>
        <span className="channel-strip__knob-label">Q 1.00</span>
      </div>
      <div className="channel-strip__foot">
        <button type="button" className="strip-foot-btn" disabled>
          -
        </button>
        <button type="button" className="strip-foot-btn" disabled>
          +
        </button>
      </div>
    </div>
  );
}

const formatFrequency = (frequency: number) => {
  if (frequency >= 1000) {
    const value = (frequency / 1000).toFixed(frequency >= 10000 ? 0 : 1);
    return `${value} kHz`;
  }
  return `${frequency} Hz`;
};
