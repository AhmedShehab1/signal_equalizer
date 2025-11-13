/**
 * SourceCard Component
 * 
 * Reusable card for displaying and controlling a single separated audio source.
 * Model-agnostic design works with both speech (DPRNN) and music (Demucs) sources.
 * Features play/pause, solo, mute, and gain controls with optional spectrogram visualization.
 * 
 * @example
 * ```tsx
 * <SourceCard
 *   sourceId="drums"
 *   label="Drums"
 *   gain={1.0}
 *   isMuted={false}
 *   isSoloed={false}
 *   isPlaying={false}
 *   onPlayToggle={(id) => playSource(id)}
 *   onSoloToggle={(id) => toggleSolo(id)}
 *   onMuteToggle={(id) => toggleMute(id)}
 *   onGainChange={(id, gain) => setGain(id, gain)}
 *   spectrogramUrl="/path/to/spectrogram.png"
 *   audioShape="2 × 44100"
 * />
 * ```
 */

import type { SourceCardProps } from './types';

export function SourceCard({
  sourceId,
  label,
  gain,
  isMuted,
  isSoloed,
  isPlaying,
  onPlayToggle,
  onSoloToggle,
  onMuteToggle,
  onGainChange,
  spectrogramUrl,
  audioShape,
  disabled = false
}: SourceCardProps) {
  
  return (
    <div className="source-card">
      {/* Source Header */}
      <div className="source-header">
        <label htmlFor={`gain-${sourceId}`} className="source-label">
          {label}
        </label>
        
        {/* Action Buttons */}
        <div className="source-actions">
          <button
            onClick={() => onPlayToggle(sourceId)}
            disabled={disabled}
            className={`play-button ${isPlaying ? 'playing' : ''}`}
            title={isPlaying ? 'Stop playback' : 'Play source'}
            aria-label={isPlaying ? `Stop playing ${label}` : `Play ${label}`}
          >
            {isPlaying ? '⏸ Playing' : '▶ Play'}
          </button>
          
          <button
            onClick={() => onSoloToggle(sourceId)}
            disabled={disabled}
            className={`solo-button ${isSoloed ? 'soloed' : ''}`}
            title={isSoloed ? 'Unsolo (restore all sources)' : 'Solo (mute all other sources)'}
            aria-label={isSoloed ? `Unsolo ${label}` : `Solo ${label}`}
            aria-pressed={isSoloed}
          >
            🎵 Solo
          </button>
          
          <button
            onClick={() => onMuteToggle(sourceId)}
            disabled={disabled}
            className={`mute-button ${isMuted ? 'muted' : ''}`}
            title={isMuted ? 'Unmute source' : 'Mute source'}
            aria-label={isMuted ? `Unmute ${label}` : `Mute ${label}`}
            aria-pressed={isMuted}
          >
            {isMuted ? '🔇 Muted' : '🔊 Mute'}
          </button>
          
          <span className="gain-value" aria-live="polite">
            {gain.toFixed(2)}×
          </span>
        </div>
      </div>
      
      {/* Gain Slider */}
      <input
        id={`gain-${sourceId}`}
        type="range"
        min="0"
        max="2"
        step="0.01"
        value={gain}
        onChange={(e) => onGainChange(sourceId, parseFloat(e.target.value))}
        disabled={disabled}
        className="gain-slider"
        aria-label={`${label} gain control`}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={gain}
        aria-valuetext={`${gain.toFixed(2)} times`}
      />
      
      {/* Source Metadata */}
      {audioShape && (
        <div className="source-info">
          <span className="source-shape">
            Shape: {audioShape}
          </span>
        </div>
      )}
      
      {/* Optional Spectrogram */}
      {spectrogramUrl && (
        <div className="source-spectrogram">
          <img 
            src={spectrogramUrl} 
            alt={`${label} spectrogram`}
            loading="lazy"
            className="spectrogram-image"
          />
        </div>
      )}
    </div>
  );
}
