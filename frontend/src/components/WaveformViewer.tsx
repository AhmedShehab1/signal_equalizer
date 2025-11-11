/**
 * Component for visualizing audio waveform with X-axis pan and zoom
 */

import { useEffect, useRef, useState } from 'react';
import { WaveformViewRange } from '../model/types';

interface WaveformViewerProps {
  audioBuffer: AudioBuffer | null;
  currentTime?: number;
  viewRange?: WaveformViewRange;
  onViewRangeChange?: (range: WaveformViewRange) => void;
  title?: string;
}

export default function WaveformViewer({
  audioBuffer,
  currentTime = 0,
  viewRange,
  onViewRangeChange,
  title = 'Waveform',
}: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; range: WaveformViewRange } | null>(null);

  // Draw waveform (uses full buffer if no viewRange is provided)
  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const totalSamples = data.length;
    const sampleRate = audioBuffer.sampleRate;

    // Convert time range to sample indices
    const startSample = viewRange 
      ? Math.max(0, Math.floor(viewRange.startTime * sampleRate)) 
      : 0;
    const endSample = viewRange
      ? Math.min(totalSamples - 1, Math.floor(viewRange.endTime * sampleRate))
      : totalSamples - 1;

    const visibleLen = Math.max(1, endSample - startSample + 1);
    const samplesPerPixel = visibleLen / width;
    const step = Math.max(1, Math.ceil(samplesPerPixel));
    const amp = height / 2;

    // Draw waveform min/max envelope
    ctx.strokeStyle = '#646cff';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const base = startSample + Math.floor(x * samplesPerPixel);
      let min = 0;
      let max = 0;

      const end = Math.min(base + step, endSample + 1);
      for (let i = base; i < end; i++) {
        const v = data[i] || 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }

      const y1 = (1 + min) * amp;
      const y2 = (1 + max) * amp;

      if (x === 0) {
        ctx.moveTo(x, y1);
      }
      ctx.lineTo(x, y1);
      ctx.lineTo(x, y2);
    }

    ctx.stroke();

    // Draw current time indicator (within view range only)
    if (currentTime > 0) {
      const currentSample = Math.floor(currentTime * audioBuffer.sampleRate);
      if (currentSample >= startSample && currentSample <= endSample) {
        const frac = (currentSample - startSample) / visibleLen;
        const x = frac * width;
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
  }, [audioBuffer, currentTime, viewRange]);

  // Zoom handler (wheel) – X-axis only, anchored at mouse position
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!onViewRangeChange || !audioBuffer || !viewRange || !canvasRef.current) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1; // <0 => zoom in
    const totalDuration = audioBuffer.duration;

    const currentRange = viewRange.endTime - viewRange.startTime;
    let newRange = currentRange * zoomFactor;

    // Clamp zoom level (in seconds)
    const MIN_RANGE_SECONDS = 0.1;
    if (newRange < MIN_RANGE_SECONDS) newRange = MIN_RANGE_SECONDS;
    if (newRange > totalDuration) newRange = totalDuration;

    const percent = mouseX / canvas.width;
    const anchorPoint = viewRange.startTime + currentRange * percent;

    let newStartTime = anchorPoint - newRange * percent;
    let newEndTime = newStartTime + newRange;

    // Clamp to [0, totalDuration]
    if (newStartTime < 0) {
      newStartTime = 0;
      newEndTime = newRange;
    }
    if (newEndTime > totalDuration) {
      newEndTime = totalDuration;
      newStartTime = newEndTime - newRange;
      if (newStartTime < 0) newStartTime = 0; // guard
    }

    const newZoomLevel = totalDuration / newRange;
    onViewRangeChange({ startTime: newStartTime, endTime: newEndTime, zoomLevel: newZoomLevel });
  };

  // Panning (mouse drag)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onViewRangeChange || !viewRange) return;
    setDragStart({ x: e.clientX, range: viewRange });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragStart || !onViewRangeChange || !audioBuffer || !canvasRef.current) return;

    const totalDuration = audioBuffer.duration;
    const width = canvasRef.current.width;

    const dx = e.clientX - dragStart.x;
    const rangeTime = dragStart.range.endTime - dragStart.range.startTime;
    const secondsPerPixel = rangeTime / width;
    const panAmount = dx * secondsPerPixel;

    let newStartTime = dragStart.range.startTime - panAmount;
    let newEndTime = dragStart.range.endTime - panAmount;

    // Clamp panning
    if (newStartTime < 0) {
      newStartTime = 0;
      newEndTime = rangeTime;
    }
    if (newEndTime > totalDuration) {
      newEndTime = totalDuration;
      newStartTime = newEndTime - rangeTime;
      if (newStartTime < 0) newStartTime = 0;
    }

    onViewRangeChange({ 
      startTime: newStartTime, 
      endTime: newEndTime, 
      zoomLevel: totalDuration / rangeTime 
    });
  };

  const handleMouseUp = () => setDragStart(null);

  return (
    <div className="waveform-viewer">
      <h3>{title}</h3>
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        style={{ width: '100%', height: 'auto', border: '1px solid #333', cursor: onViewRangeChange ? 'grab' : 'default' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
