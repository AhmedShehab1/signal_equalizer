/**
 * Short-Time Fourier Transform implementation
 * Computes time-frequency representation of a signal
 */

import { fft, getMagnitudeSpectrum, padToPowerOf2 } from './fft';

export interface STFTResult {
  magnitudes: number[][];
  frequencies: number[];
  times: number[];
}

/**
 * Apply Hamming window to signal
 */
function hammingWindow(length: number): number[] {
  const window = new Array(length);
  for (let i = 0; i < length; i++) {
    window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (length - 1));
  }
  return window;
}

/**
 * Compute STFT of a signal
 * @param signal - Input signal
 * @param windowSize - Size of the analysis window
 * @param hopSize - Number of samples between successive windows
 * @param sampleRate - Sample rate of the signal
 * @returns STFT result with time-frequency representation
 */
export function stft(
  signal: number[],
  windowSize: number = 2048,
  hopSize: number = 512,
  sampleRate: number = 44100
): STFTResult {
  const window = hammingWindow(windowSize);
  const numFrames = Math.floor((signal.length - windowSize) / hopSize) + 1;
  
  const magnitudes: number[][] = [];
  const times: number[] = [];
  
  for (let frame = 0; frame < numFrames; frame++) {
    const start = frame * hopSize;
    const windowedSignal = new Array(windowSize);
    
    // Apply window to signal segment
    for (let i = 0; i < windowSize; i++) {
      windowedSignal[i] = signal[start + i] * window[i];
    }
    
    // Compute FFT
    const paddedSignal = padToPowerOf2(windowedSignal);
    const fftResult = fft(paddedSignal);
    const magnitude = getMagnitudeSpectrum(fftResult);
    
    // Store only positive frequencies
    magnitudes.push(magnitude.slice(0, magnitude.length / 2));
    times.push(start / sampleRate);
  }
  
  // Generate frequency bins
  const frequencies: number[] = [];
  const numBins = magnitudes[0].length;
  for (let i = 0; i < numBins; i++) {
    frequencies.push((i * sampleRate) / (windowSize * 2));
  }
  
  return {
    magnitudes,
    frequencies,
    times,
  };
}

/**
 * Convert magnitude to dB scale
 */
export function magnitudeToDb(magnitude: number): number {
  return 20 * Math.log10(Math.max(magnitude, 1e-10));
}
