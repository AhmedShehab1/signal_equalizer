/**
 * Component for visualizing audio waveform
 */

import { useEffect, useRef } from 'react';

interface WaveformViewerProps {
  audioBuffer: AudioBuffer | null;
  currentTime?: number;
}

export default function WaveformViewer({ audioBuffer, currentTime = 0 }: WaveformViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !audioBuffer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Get audio data
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    // Draw waveform
    ctx.strokeStyle = '#646cff';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      const min = Math.min(...Array.from({ length: step }, (_, j) => data[i * step + j] || 0));
      const max = Math.max(...Array.from({ length: step }, (_, j) => data[i * step + j] || 0));
      
      const y1 = (1 + min) * amp;
      const y2 = (1 + max) * amp;

      if (i === 0) {
        ctx.moveTo(i, y1);
      }
      ctx.lineTo(i, y1);
      ctx.lineTo(i, y2);
    }

    ctx.stroke();

    // Draw current time indicator
    if (currentTime > 0) {
      const x = (currentTime / audioBuffer.duration) * width;
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [audioBuffer, currentTime]);

  return (
    <div className="waveform-viewer">
      <h3>Waveform</h3>
      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        style={{ width: '100%', height: 'auto', border: '1px solid #333' }}
      />
    </div>
  );
}
