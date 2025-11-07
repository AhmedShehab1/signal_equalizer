/**
 * Short-Time Fourier Transform implementation
 * Computes time-frequency representation of a signal
 */

import { fft, ifft, Complex, getMagnitudeSpectrum, padToPowerOf2 } from './fft';

export interface STFTResult {
  magnitudes: number[][];
  frequencies: number[];
  times: number[];
}

// Hann window (preferred for STFT/ISTFT WOLA)
export function getHannWindow(windowSize: number): Float32Array {
  const window = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }
  return window;
}

// Keep existing API but switch to Hann window
/**
 * Compute STFT magnitude spectrogram (legacy API)
 * @param signal - Input signal
 * @param windowSize - Size of the analysis window
 * @param hopSize - Number of samples between successive windows
 * @param sampleRate - Sample rate of the signal
 */
export function stft(
  signal: number[],
  windowSize: number = 2048,
  hopSize: number = 512,
  sampleRate: number = 44100
): STFTResult {
  const window = getHannWindow(windowSize);
  const numFrames = Math.floor((signal.length - windowSize) / hopSize) + 1;

  const magnitudes: number[][] = [];
  const times: number[] = [];

  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;
    const windowedSignal = new Array(windowSize);

    for (let i = 0; i < windowSize; i++) {
      windowedSignal[i] = signal[start + i] * window[i];
    }

    const paddedSignal = padToPowerOf2(windowedSignal);
    const fftResult = fft(paddedSignal);
    const magnitude = getMagnitudeSpectrum(fftResult);

    magnitudes.push(magnitude.slice(0, magnitude.length / 2));
    times.push(start / sampleRate);
  }

  const frequencies: number[] = [];
  const numBins = magnitudes[0]?.length ?? 0;
  for (let i = 0; i < numBins; i++) {
    frequencies.push((i * sampleRate) / (windowSize * 2));
  }

  return { magnitudes, frequencies, times };
}

// Spec-friendly options and STFT/ISTFT implementations
export interface STFTOptions {
  windowSize: number;
  hopSize: number;
  fftSize: number; // typically equals windowSize
}

/**
 * Frame-based STFT returning complex spectra per frame
 */
export function stftFrames(
  signal: Float32Array,
  options: STFTOptions
): Complex[][] {
  const { windowSize, hopSize, fftSize } = options;
  const hannWindow = getHannWindow(windowSize);
  const stftFrames: Complex[][] = [];

  let offset = 0;
  while (offset + windowSize <= signal.length) {
    const frame: Complex[] = new Array(fftSize);
    // initialize with zeros
    for (let i = 0; i < fftSize; i++) frame[i] = { re: 0, im: 0 };

    // analysis window
    for (let i = 0; i < windowSize; i++) {
      frame[i] = {
        re: signal[offset + i] * hannWindow[i],
        im: 0,
      };
    }

    // FFT
    const fftResult = fft(frame);
    stftFrames.push(fftResult);

    offset += hopSize;
  }
  return stftFrames;
}

/**
 * Inverse STFT with Weighted Overlap-Add (WOLA)
 */
export function istft(
  stftFramesIn: Complex[][],
  options: STFTOptions
): Float32Array {
  const { windowSize, hopSize } = options;
  const hannWindow = getHannWindow(windowSize);

  const numFrames = stftFramesIn.length;
  if (numFrames === 0) return new Float32Array(0);

  const outputLength = (numFrames - 1) * hopSize + windowSize;
  const outputSignal = new Float32Array(outputLength);
  const windowSum = new Float32Array(outputLength);

  let offset = 0;
  for (const frame of stftFramesIn) {
    const ifftResult = ifft(frame);

    for (let i = 0; i < windowSize; i++) {
      outputSignal[offset + i] += ifftResult[i].re * hannWindow[i];
      windowSum[offset + i] += hannWindow[i] * hannWindow[i];
    }
    offset += hopSize;
  }

  for (let i = 0; i < outputLength; i++) {
    if (windowSum[i] > 1e-6) {
      outputSignal[i] /= windowSum[i];
    }
  }
  return outputSignal;
}

/**
 * Convert magnitude to dB scale
 */
export function magnitudeToDb(magnitude: number): number {
  return 20 * Math.log10(Math.max(magnitude, 1e-10));
}
