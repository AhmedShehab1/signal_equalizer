/**
 * Linked waveform viewers with shared pan/zoom state
 * Two synchronized cine signal viewers with full control panel
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import WaveformViewer from './WaveformViewer';
import { WaveformViewRange } from '../model/types';
import './LinkedWaveformViewers.css';

interface LinkedWaveformViewersProps {
  inputBuffer: AudioBuffer | null;
  outputBuffer: AudioBuffer | null;
  currentTime: number;
  /** Callback when user seeks by clicking on waveform */
  onSeek?: (time: number) => void;
}

export default function LinkedWaveformViewers({
  inputBuffer,
  outputBuffer,
  currentTime,
  // onSeek is available for future seek-on-click functionality
  onSeek: _onSeek,
}: LinkedWaveformViewersProps) {
  // Mark as intentionally unused for now
  void _onSeek;
  // Shared view range state (in seconds)
  const [viewRange, setViewRange] = useState<WaveformViewRange>(() => ({
    startTime: 0,
    endTime: inputBuffer?.duration || 10,
    zoomLevel: 1.0,
  }));

  // Update view range when buffer changes
  useEffect(() => {
    if (inputBuffer) {
      setViewRange({
        startTime: 0,
        endTime: inputBuffer.duration,
        zoomLevel: 1.0,
      });
    }
  }, [inputBuffer]);

  const handleViewRangeChange = useCallback((newRange: WaveformViewRange) => {
    setViewRange(newRange);
  }, []);

  // Reset view to show full waveform
  const handleResetView = useCallback(() => {
    const duration = inputBuffer?.duration || outputBuffer?.duration || 10;
    setViewRange({
      startTime: 0,
      endTime: duration,
      zoomLevel: 1.0,
    });
  }, [inputBuffer, outputBuffer]);

  // Zoom in (2x)
  const handleZoomIn = useCallback(() => {
    const duration = inputBuffer?.duration || 10;
    const currentRange = viewRange.endTime - viewRange.startTime;
    const newRange = Math.max(0.1, currentRange / 2);
    const center = (viewRange.startTime + viewRange.endTime) / 2;
    let newStart = center - newRange / 2;
    let newEnd = center + newRange / 2;
    
    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }
    if (newEnd > duration) {
      newEnd = duration;
      newStart = Math.max(0, newEnd - newRange);
    }
    
    setViewRange({
      startTime: newStart,
      endTime: newEnd,
      zoomLevel: duration / newRange,
    });
  }, [viewRange, inputBuffer]);

  // Zoom out (0.5x)
  const handleZoomOut = useCallback(() => {
    const duration = inputBuffer?.duration || 10;
    const currentRange = viewRange.endTime - viewRange.startTime;
    const newRange = Math.min(duration, currentRange * 2);
    const center = (viewRange.startTime + viewRange.endTime) / 2;
    let newStart = center - newRange / 2;
    let newEnd = center + newRange / 2;
    
    if (newStart < 0) {
      newStart = 0;
      newEnd = newRange;
    }
    if (newEnd > duration) {
      newEnd = duration;
      newStart = Math.max(0, newEnd - newRange);
    }
    
    setViewRange({
      startTime: newStart,
      endTime: newEnd,
      zoomLevel: duration / newRange,
    });
  }, [viewRange, inputBuffer]);

  // Pan left
  const handlePanLeft = useCallback(() => {
    const duration = inputBuffer?.duration || 10;
    const currentRange = viewRange.endTime - viewRange.startTime;
    const panAmount = currentRange * 0.25;
    const newStart = Math.max(0, viewRange.startTime - panAmount);
    const newEnd = newStart + currentRange;
    
    setViewRange({
      startTime: newStart,
      endTime: Math.min(duration, newEnd),
      zoomLevel: viewRange.zoomLevel,
    });
  }, [viewRange, inputBuffer]);

  // Pan right
  const handlePanRight = useCallback(() => {
    const duration = inputBuffer?.duration || 10;
    const currentRange = viewRange.endTime - viewRange.startTime;
    const panAmount = currentRange * 0.25;
    const newEnd = Math.min(duration, viewRange.endTime + panAmount);
    const newStart = newEnd - currentRange;
    
    setViewRange({
      startTime: Math.max(0, newStart),
      endTime: newEnd,
      zoomLevel: viewRange.zoomLevel,
    });
  }, [viewRange, inputBuffer]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  };

  // Memoize to prevent unnecessary re-renders
  const memoizedViewRange = useMemo(() => viewRange, [viewRange]);

  const hasBuffer = inputBuffer || outputBuffer;

  return (
    <div className="linked-viewers">
      {/* Control Panel */}
      <div className="viewers-control-panel">
        <div className="control-group">
          <span className="control-label">View:</span>
          <div className="control-buttons">
            <button
              className="control-btn"
              onClick={handlePanLeft}
              disabled={!hasBuffer || viewRange.startTime <= 0}
              title="Pan Left"
            >
              ◀
            </button>
            <button
              className="control-btn"
              onClick={handleZoomIn}
              disabled={!hasBuffer}
              title="Zoom In"
            >
              🔍+
            </button>
            <button
              className="control-btn"
              onClick={handleZoomOut}
              disabled={!hasBuffer || viewRange.zoomLevel <= 1.0}
              title="Zoom Out"
            >
              🔍−
            </button>
            <button
              className="control-btn"
              onClick={handlePanRight}
              disabled={!hasBuffer || viewRange.endTime >= (inputBuffer?.duration || 10)}
              title="Pan Right"
            >
              ▶
            </button>
            <button
              className="control-btn reset-btn"
              onClick={handleResetView}
              disabled={!hasBuffer}
              title="Reset View"
            >
              ↺
            </button>
          </div>
        </div>
        
        <div className="view-info">
          <span className="zoom-badge">
            {viewRange.zoomLevel.toFixed(1)}×
          </span>
          <span className="time-range">
            {formatTime(viewRange.startTime)} – {formatTime(viewRange.endTime)}
          </span>
        </div>
      </div>

      {/* Waveform Viewers - Stacked vertically */}
      <div className="viewers-stack">
        <div className="viewer-row">
          <div className="viewer-label">
            <span className="label-dot input"></span>
            Input
          </div>
          <div className="viewer-canvas">
            <WaveformViewer
              audioBuffer={inputBuffer}
              currentTime={currentTime}
              viewRange={memoizedViewRange}
              onViewRangeChange={handleViewRangeChange}
              title=""
            />
          </div>
        </div>

        <div className="viewer-row">
          <div className="viewer-label">
            <span className="label-dot output"></span>
            Output
          </div>
          <div className="viewer-canvas">
            <WaveformViewer
              audioBuffer={outputBuffer}
              currentTime={currentTime}
              viewRange={memoizedViewRange}
              onViewRangeChange={handleViewRangeChange}
              title=""
            />
          </div>
        </div>
      </div>

      {/* Sync indicator */}
      <div className="sync-indicator">
        <span className="sync-icon">🔗</span>
        <span className="sync-text">Viewers synced • Scroll to zoom • Drag to pan</span>
      </div>
    </div>
  );
}
