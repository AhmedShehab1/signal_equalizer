import { requestFFT, requestIFFT } from './dspApi';
import type { Complex } from './dspTypes';
export type { Complex } from './dspTypes';

/**
 * Delegate FFT computation to the backend DSP service.
 */
export async function fft(x: Complex[], abortSignal?: AbortSignal): Promise<Complex[]> {
  return requestFFT(x, abortSignal);
}

/**
 * Delegate IFFT computation to the backend DSP service.
 */
export async function ifft(X: Complex[], abortSignal?: AbortSignal): Promise<Complex[]> {
  return requestIFFT(X, abortSignal);
}
