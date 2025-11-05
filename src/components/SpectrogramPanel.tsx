/**
 * Component for displaying spectrogram
 */

import { useEffect, useRef } from 'react';
import { SpectrogramData } from '../model/types';
import { renderSpectrogram } from '../lib/spectrogram';

interface SpectrogramPanelProps {
  spectrogramData: SpectrogramData | null;
}

export default function SpectrogramPanel({ spectrogramData }: SpectrogramPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !spectrogramData) return;

    renderSpectrogram(canvasRef.current, spectrogramData);
  }, [spectrogramData]);

  if (!spectrogramData) {
    return (
      <div className="spectrogram-panel">
        <h3>Spectrogram</h3>
        <p>Load an audio file to see the spectrogram</p>
      </div>
    );
  }

  return (
    <div className="spectrogram-panel">
      <h3>Spectrogram</h3>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: 'auto', border: '1px solid #333' }}
      />
    </div>
  );
}
