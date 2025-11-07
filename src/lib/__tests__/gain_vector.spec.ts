import { describe, it, expect } from 'vitest';
import { buildGainVector } from '../spectrogram';
import { BandSpec } from '../../model/types';

function freqToBin(freq: number, fftSize: number, sampleRate: number): number {
  return Math.round((freq * fftSize) / sampleRate);
}

describe('buildGainVector product-of-scales', () => {
  it('applies overlapping bands multiplicatively', () => {
    const fftSize = 2048;
    const sampleRate = 48000;

    const bands: BandSpec[] = [
      { scale: 0.8, windows: [{ f_start_hz: 0, f_end_hz: 500 }] },
      { scale: 0.5, windows: [{ f_start_hz: 100, f_end_hz: 200 }] },
    ];

    const gv = buildGainVector(bands, fftSize, sampleRate);

    const bin50 = freqToBin(50, fftSize, sampleRate);
    const bin150 = freqToBin(150, fftSize, sampleRate);
    const bin1000 = freqToBin(1000, fftSize, sampleRate);

    expect(gv[bin50]).toBeCloseTo(0.8, 6);
    expect(gv[bin150]).toBeCloseTo(0.8 * 0.5, 6);
    expect(gv[bin1000]).toBeCloseTo(1.0, 6);
  });

  it('handles multi-window bands', () => {
    const fftSize = 1024;
    const sampleRate = 44100;

    const bands: BandSpec[] = [
      {
        scale: 1.5,
        windows: [
          { f_start_hz: 300, f_end_hz: 400 },
          { f_start_hz: 1000, f_end_hz: 1200 },
        ],
      },
    ];

    const gv = buildGainVector(bands, fftSize, sampleRate);

    const bin350 = Math.round((350 * fftSize) / sampleRate);
    const bin1100 = Math.round((1100 * fftSize) / sampleRate);
    const bin700 = Math.round((700 * fftSize) / sampleRate);

    expect(gv[bin350]).toBeCloseTo(1.5, 6);
    expect(gv[bin1100]).toBeCloseTo(1.5, 6);
    expect(gv[bin700]).toBeCloseTo(1.0, 6);
  });
});
