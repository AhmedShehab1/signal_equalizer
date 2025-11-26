import type { Complex } from './dspTypes';
import type { STFTOptions } from '../model/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DspErrorPayload {
  detail?: string;
  message?: string;
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload as DspErrorPayload;
    throw new Error(error.detail || error.message || 'DSP request failed');
  }
  return payload as T;
}

function serializeOptions(options: STFTOptions) {
  return {
    window_size: options.windowSize,
    hop_size: options.hopSize,
    fft_size: options.fftSize,
  };
}

export async function requestFFT(signal: Complex[], signalAbort?: AbortSignal): Promise<Complex[]> {
  const data = await postJson<{ spectrum: Complex[] }>(
    '/api/dsp/fft',
    { signal },
    signalAbort
  );
  return data.spectrum;
}

export async function requestIFFT(spectrum: Complex[], signalAbort?: AbortSignal): Promise<Complex[]> {
  const data = await postJson<{ signal: Complex[] }>(
    '/api/dsp/ifft',
    { spectrum },
    signalAbort
  );
  return data.signal;
}

export interface StftResponse {
  frames?: Complex[][];
  magnitudes?: number[][];
  frequencies?: number[];
  times?: number[];
}

export async function requestSTFT(
  signal: number[],
  sampleRate: number,
  options: STFTOptions,
  includeFrames: boolean,
  includeMagnitudes: boolean,
  signalAbort?: AbortSignal
): Promise<StftResponse> {
  return postJson<StftResponse>(
    '/api/dsp/stft',
    {
      signal,
      sample_rate: sampleRate,
      options: serializeOptions(options),
      include_frames: includeFrames,
      include_magnitudes: includeMagnitudes,
    },
    signalAbort
  );
}

export async function requestISTFT(
  frames: Complex[][],
  options: STFTOptions,
  signalAbort?: AbortSignal
): Promise<number[]> {
  const data = await postJson<{ signal: number[] }>(
    '/api/dsp/istft',
    {
      frames,
      options: serializeOptions(options),
    },
    signalAbort
  );
  return data.signal;
}
