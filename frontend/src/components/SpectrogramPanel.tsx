/**
 * Spectrogram panel with selectable frequency scale: linear | audiogram (log)
 */
import { useEffect, useRef, useState } from 'react';
import { SpectrogramData } from '../model/types';

interface SpectrogramPanelProps {
  spectrogramData: SpectrogramData | null;
}

export default function SpectrogramPanel({
  spectrogramData,
}: SpectrogramPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [freqScale, setFreqScale] = useState<'linear' | 'audiogram'>('linear');

  useEffect(() => {
    if (!spectrogramData || !canvasRef.current) return;
    const { data, frequencyBins, maxMagnitude } = spectrogramData;
    if (!data.length || !frequencyBins.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const numFrames = data.length;
    const numBins = frequencyBins.length;
    // Set canvas size (can adjust as needed)
    canvas.width = 800; // frequency axis
    canvas.height = 300; // time axis

    const nyquist = Math.max(...frequencyBins);
    const fMinLog = 20;
    const minLog = Math.log10(fMinLog);
    const maxLog = Math.log10(nyquist);
    const logRange = maxLog - minLog;

    function freqToXLinear(freqHz: number, width: number): number {
      return (freqHz / nyquist) * width;
    }
    function freqToXLog(freqHz: number, width: number): number {
      if (freqHz < fMinLog) return 0;
      const logPos = (Math.log10(freqHz) - minLog) / logRange;
      return logPos * width;
    }
    const getX = freqScale === 'linear' ? freqToXLinear : freqToXLog;

    // Clear
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw spectrogram: time -> y, freq -> x
    const timeScale = canvas.height / numFrames;
    const dynamicRange = 80; // dB span for normalization

    for (let t = 0; t < numFrames; t++) {
      const row = data[t]; // already in dB
      for (let i = 0; i < numBins - 1; i++) {
        const f0 = frequencyBins[i];
        const f1 = frequencyBins[i + 1];
        const x0 = getX(f0, canvas.width);
        const x1 = getX(f1, canvas.width);
        const colWidth = Math.max(1, x1 - x0);

        const magDb = row[i];
        // Normalize into 0..1 (clip)
        const norm = Math.min(
          1,
          Math.max(0, (magDb - (maxMagnitude - dynamicRange)) / dynamicRange)
        );

        // Simple color map (dark -> bright)
        const r = Math.floor(norm * 255);
        const g = Math.floor(Math.sin(norm * Math.PI) * 255);
        const b = Math.floor((1 - norm) * 180);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x0, t * timeScale, colWidth, timeScale + 0.5);
      }
    }

    // Axis / ticks (bottom frequency axis)
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';

    if (freqScale === 'audiogram') {
      const ticks = [125, 250, 500, 1000, 2000, 4000, 8000].filter(f => f <= nyquist);
      const labels = ticks.map(f => (f >= 1000 ? `${f / 1000}k` : `${f}`));
      for (let i = 0; i < ticks.length; i++) {
        const x = getX(ticks[i], canvas.width);
        ctx.strokeStyle = '#ccc';
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - 15);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        ctx.fillText(labels[i], x, canvas.height - 18);
      }
    } else {
      const linearTicks = 6;
      for (let i = 0; i <= linearTicks; i++) {
        const frac = i / linearTicks;
        const freq = frac * nyquist;
        const x = getX(freq, canvas.width);
        ctx.strokeStyle = '#ccc';
        ctx.beginPath();
        ctx.moveTo(x, canvas.height - 15);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        const label =
          freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${Math.round(freq)} Hz`;
        ctx.fillText(label, x, canvas.height - 18);
      }
    }

    // Label
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(
      freqScale === 'linear' ? 'Linear Frequency' : 'Audiogram (Log) Frequency',
      canvas.width - 8,
      14
    );
  }, [spectrogramData, freqScale]);

  if (!spectrogramData) {
    return (
      <div className="spectrogram-panel">
        <h3>Spectrogram</h3>
        <p>Load an audio file to see the spectrogram.</p>
      </div>
    );
  }

  return (
    <div className="spectrogram-panel">
      <h3>Spectrogram</h3>
      <div style={{ marginBottom: '8px' }}>
        <button
          onClick={() => setFreqScale('linear')}
          disabled={freqScale === 'linear'}
        >
          Linear
        </button>
        <button
          onClick={() => setFreqScale('audiogram')}
          disabled={freqScale === 'audiogram'}
          style={{ marginLeft: '4px' }}
        >
          Audiogram
        </button>
      </div>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 'auto',
          border: '1px solid #333',
          display: 'block',
        }}
      />
    </div>
  );
}
