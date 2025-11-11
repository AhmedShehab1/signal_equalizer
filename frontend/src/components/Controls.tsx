/**
 * Component for playback controls
 */

import { PlaybackState } from '../model/types';

interface ControlsProps {
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
}

export default function Controls({
  playbackState,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onPlaybackRateChange,
}: ControlsProps) {
  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(event.target.value);
    onSeek(time);
  };

  const handlePlaybackRateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const rate = parseFloat(event.target.value);
    if (onPlaybackRateChange) {
      onPlaybackRateChange(rate);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="controls">
      <div className="playback-buttons">
        {!playbackState.isPlaying ? (
          <button onClick={onPlay}>Play</button>
        ) : (
          <button onClick={onPause}>Pause</button>
        )}
        <button onClick={onStop}>Stop</button>
        
        {onPlaybackRateChange && (
          <div className="playback-rate-control">
            <label htmlFor="playback-rate">Speed:</label>
            <select 
              id="playback-rate"
              value={playbackState.playbackRate.toString()}
              onChange={handlePlaybackRateChange}
              aria-label="Playback speed"
            >
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1">1×</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </div>
        )}
      </div>
      
      <div className="seek-control">
        <span>{formatTime(playbackState.currentTime)}</span>
        <input
          type="range"
          min="0"
          max={playbackState.duration || 0}
          step="0.1"
          value={playbackState.currentTime}
          onChange={handleSeek}
          style={{ width: '300px' }}
        />
        <span>{formatTime(playbackState.duration)}</span>
      </div>
    </div>
  );
}
