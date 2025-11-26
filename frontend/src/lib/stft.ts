import type { Complex } from './dspTypes';
import { requestISTFT, requestSTFT } from './dspApi';
import type { STFTOptions } from '../model/types';

export interface STFTResult {
  magnitudes: number[][];
  frequencies: number[];
  times: number[];
}

export async function stft(
  signal: number[],
  windowSize: number = 2048,
  hopSize: number = 512,
  sampleRate: number = 44100
): Promise<STFTResult> {
  const options: STFTOptions = {
    windowSize,
    hopSize,
    fftSize: windowSize,
  };

  const response = await requestSTFT(
    signal,
    sampleRate,
    options,
    false,
    true
  );

  return {
    magnitudes: response.magnitudes ?? [],
    frequencies: response.frequencies ?? [],
    times: response.times ?? [],
  };
}

export async function stftFrames(
  signal: Float32Array,
  options: STFTOptions,
  sampleRate: number,
  abortSignal?: AbortSignal
): Promise<Complex[][]> {
  const response = await requestSTFT(
    Array.from(signal),
    sampleRate,
    options,
    true,
    false,
    abortSignal
  );
  return response.frames ?? [];
}

export async function istft(
  stftFramesIn: Complex[][],
  options: STFTOptions,
  abortSignal?: AbortSignal
): Promise<Float32Array> {
  const samples = await requestISTFT(stftFramesIn, options, abortSignal);
  return Float32Array.from(samples);
}

/**
 * Convert magnitude to dB scale
 */
export function magnitudeToDb(magnitude: number): number {
  return 20 * Math.log10(Math.max(magnitude, 1e-10));
}
