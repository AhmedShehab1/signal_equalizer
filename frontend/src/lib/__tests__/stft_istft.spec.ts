import { describe, it, expect } from 'vitest';
import { stftFrames, istft, STFTOptions } from '../stft';
import { Complex } from '../fft';

function rms(a: Float32Array, b: Float32Array): number {
  const N = Math.min(a.length, b.length);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const d = a[i] - b[i];
    acc += d * d;
  }
  return Math.sqrt(acc / N);
}

describe('STFT/ISTFT WOLA round-trip', () => {
  it('reconstructs within tolerance (Hann, 50% overlap)', () => {
    const sampleRate = 44100;
    const windowSize = 1024;
    const hopSize = 512; // 50% overlap
    const fftSize = windowSize;

    const seconds = 1;
    const N = sampleRate * seconds;
    const signal = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      // Pure sine (no random) for tighter tolerance
      signal[n] = 0.8 * Math.sin((2 * Math.PI * 440 * n) / sampleRate);
    }

    const options: STFTOptions = { windowSize, hopSize, fftSize };
    const frames: Complex[][] = stftFrames(signal, options);
    const recon = istft(frames, options);

    // Compare only the region fully covered by frames (edge taper)
    const validLen = (frames.length - 1) * hopSize + windowSize;
    const ref = signal.subarray(0, validLen);
    const out = recon.subarray(0, validLen);

    // Overall RMS (includes boundary taper effects)
    expect(rms(ref, out)).toBeLessThan(5e-3);

    // Center region (no window taper) should be very tight
    const centerStart = windowSize;
    const centerEnd = validLen - windowSize;
    if (centerEnd > centerStart) {
      const refCenter = ref.subarray(centerStart, centerEnd);
      const outCenter = out.subarray(centerStart, centerEnd);
      expect(rms(refCenter, outCenter)).toBeLessThan(1e-4);
    }
  });

  it('reconstructs within tolerance (Hann, 75% overlap)', () => {
    const sampleRate = 48000;
    const windowSize = 1024;
    const hopSize = 256; // 75% overlap
    const fftSize = windowSize;

    const N = 48000;
    const signal = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      signal[n] = Math.sin((2 * Math.PI * 1000 * n) / sampleRate);
    }

    const options: STFTOptions = { windowSize, hopSize, fftSize };
    const frames = stftFrames(signal, options);
    const recon = istft(frames, options);

    const validLen = (frames.length - 1) * hopSize + windowSize;
    const ref = signal.subarray(0, validLen);
    const out = recon.subarray(0, validLen);

    // 75% overlap (tight WOLA) overall tolerance
    expect(rms(ref, out)).toBeLessThan(5e-3);

    // Center region (no taper) should be tight
    const centerStart = windowSize;
    const centerEnd = validLen - windowSize;
    if (centerEnd > centerStart) {
      const refCenter = ref.subarray(centerStart, centerEnd);
      const outCenter = out.subarray(centerStart, centerEnd);
      expect(rms(refCenter, outCenter)).toBeLessThan(1e-4);
    }
  });

  it('preserves energy approximately', () => {
    const sampleRate = 44100;
    const windowSize = 512;
    const hopSize = 256;
    const fftSize = windowSize;

    const N = 8820; // ~0.2 sec
    const signal = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      signal[n] = Math.sin((2 * Math.PI * 880 * n) / sampleRate);
    }

    const options: STFTOptions = { windowSize, hopSize, fftSize };
    const frames = stftFrames(signal, options);
    const recon = istft(frames, options);

    const validLen = Math.min((frames.length - 1) * hopSize + windowSize, N);
    const ref = signal.subarray(0, validLen);
    const out = recon.subarray(0, validLen);

    const refEnergy = Array.from(ref).reduce((s, x) => s + x * x, 0);
    const outEnergy = Array.from(out).reduce((s, x) => s + x * x, 0);

    // Energy should be preserved within 5%
    expect(Math.abs(outEnergy - refEnergy) / refEnergy).toBeLessThan(0.05);
  });
});
