import { describe, it, expect } from 'vitest';
import { fft, ifft, Complex } from '../fft';

function realToComplex(arr: number[]): Complex[] {
  return arr.map(v => ({ re: v, im: 0 }));
}

function rms(a: number[], b: number[]): number {
  const N = Math.min(a.length, b.length);
  let acc = 0;
  for (let i = 0; i < N; i++) {
    const d = a[i] - b[i];
    acc += d * d;
  }
  return Math.sqrt(acc / N);
}

describe('fft/ifft round-trip', () => {
  it('impulse', () => {
    const N = 1024;
    const x = new Array<number>(N).fill(0);
    x[0] = 1;
    const X = fft(realToComplex(x));
    const xrt = ifft(X).map(c => c.re);
    expect(rms(x, xrt)).toBeLessThan(1e-12);
  });

  it('sine wave', () => {
    const N = 1024;
    const k = 13; // bin index
    const x = new Array<number>(N);
    for (let n = 0; n < N; n++) {
      x[n] = Math.sin((2 * Math.PI * k * n) / N);
    }
    const X = fft(realToComplex(x));
    const xrt = ifft(X).map(c => c.re);
    expect(rms(x, xrt)).toBeLessThan(1e-12);
  });

  it('random signal', () => {
    const N = 1024;
    const x = new Array<number>(N).fill(0).map(() => Math.random() * 2 - 1);
    const X = fft(realToComplex(x));
    const xrt = ifft(X).map(c => c.re);
    expect(rms(x, xrt)).toBeLessThan(1e-10);
  });
});
