/**
 * Linked waveform viewers with shared pan/zoom state
 */

import { useState, useCallback, useMemo } from 'react';
import WaveformViewer from './WaveformViewer';
import { WaveformViewRange } from '../model/types';

interface LinkedWaveformViewersProps {
  inputBuffer: AudioBuffer | null;
  outputBuffer: AudioBuffer | null;
  currentTime: number;
}

export default function LinkedWaveformViewers({
  inputBuffer,
  outputBuffer,
  currentTime,
}: LinkedWaveformViewersProps) {
  // Shared view range state (in seconds)
  const [viewRange, setViewRange] = useState<WaveformViewRange>(() => ({
    startTime: 0,
    endTime: inputBuffer?.duration || 10,
    zoomLevel: 1.0,
  }));

  // Update view range when buffer changes
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

  // Memoize to prevent unnecessary re-renders
  const memoizedViewRange = useMemo(() => viewRange, [viewRange]);

  return (
    <div className="linked-waveform-viewers">
      <div className="viewer-controls">
        <button 
          onClick={handleResetView}
          className="reset-view-button"
          disabled={!inputBuffer && !outputBuffer}
        >
          Reset View
        </button>
        <span className="zoom-info">
          Zoom: {viewRange.zoomLevel.toFixed(1)}x
        </span>
      </div>

      <div className="viewers-container">
        <div className="viewer-section">
          <WaveformViewer
            audioBuffer={inputBuffer}
            currentTime={currentTime}
            viewRange={memoizedViewRange}
            onViewRangeChange={handleViewRangeChange}
            title="Input Signal"
          />
        </div>

        <div className="viewer-section">
          <WaveformViewer
            audioBuffer={outputBuffer}
            currentTime={currentTime}
            viewRange={memoizedViewRange}
            onViewRangeChange={handleViewRangeChange}
            title="Output Signal (EQ Applied)"
          />
        </div>
      </div>
    </div>
  );
}
