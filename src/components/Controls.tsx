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
}

export default function Controls({
  playbackState,
  onPlay,
  onPause,
  onStop,
  onSeek,
}: ControlsProps) {
  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(event.target.value);
    onSeek(time);
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
