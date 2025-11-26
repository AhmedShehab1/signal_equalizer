/**
 * Modern Transport Bar - Phase 7 Implementation
 * Professional playback controls with visual enhancements
 */

import { PlaybackState } from '../model/types';
import './TransportBar.css';

interface TransportBarProps {
  playbackState: PlaybackState;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
  onExport?: () => void;
  fileName?: string;
  isProcessing?: boolean;
}

export default function TransportBar({
  playbackState,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onPlaybackRateChange,
  onExport,
  fileName,
  isProcessing = false,
}: TransportBarProps) {
  
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
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = playbackState.duration > 0
    ? (playbackState.currentTime / playbackState.duration) * 100
    : 0;

  return (
    <div className="transport-bar glass-panel">
      {/* Main transport controls */}
      <div className="transport-controls">
        <div className="primary-controls">
          <button 
            className="btn btn-icon btn-ghost transport-btn" 
            onClick={onStop}
            aria-label="Stop"
            title="Stop"
            disabled={isProcessing}
          >
            ⏹
          </button>
          
          {!playbackState.isPlaying ? (
            <button 
              className="btn btn-accent play-button" 
              onClick={onPlay}
              aria-label="Play"
              title="Play"
              disabled={isProcessing}
            >
              <span className="play-icon">▶</span>
            </button>
          ) : (
            <button 
              className="btn btn-primary play-button" 
              onClick={onPause}
              aria-label="Pause"
              title="Pause"
            >
              <span className="pause-icon">⏸</span>
            </button>
          )}
        </div>

        {/* Timeline section */}
        <div className="timeline-section">
          <div className="time-display">
            <span className="current-time">{formatTime(playbackState.currentTime)}</span>
            <span className="time-separator">/</span>
            <span className="total-time">{formatTime(playbackState.duration)}</span>
          </div>
          
          <div className="timeline-wrapper">
            <div 
              className="timeline-progress" 
              style={{ width: `${progressPercentage}%` }}
            >
              <div className="progress-glow"></div>
            </div>
            <input
              type="range"
              className="timeline-slider"
              min="0"
              max={playbackState.duration || 0}
              step="0.01"
              value={playbackState.currentTime}
              onChange={handleSeek}
              aria-label="Seek position"
              aria-valuemin={0}
              aria-valuemax={playbackState.duration}
              aria-valuenow={playbackState.currentTime}
              aria-valuetext={formatTime(playbackState.currentTime)}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* Secondary controls */}
        <div className="secondary-controls">
          {onPlaybackRateChange && (
            <div className="speed-control">
              <label htmlFor="playback-speed" className="control-label">
                ⚡
              </label>
              <select 
                id="playback-speed"
                className="custom-select"
                value={playbackState.playbackRate.toString()}
                onChange={handlePlaybackRateChange}
                aria-label="Playback speed"
                disabled={isProcessing}
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

          {onExport && (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={onExport}
              disabled={isProcessing || !playbackState.duration}
              aria-label="Export audio"
              title="Export processed audio"
            >
              💾 Export
            </button>
          )}
        </div>
      </div>

      {/* File info */}
      {fileName && (
        <div className="transport-info">
          <span className="file-badge badge badge-primary">
            🎵 {fileName}
          </span>
          {isProcessing && (
            <span className="badge badge-warning">
              <span className="status-spinner"></span>
              Processing...
            </span>
          )}
        </div>
      )}
    </div>
  );
}
