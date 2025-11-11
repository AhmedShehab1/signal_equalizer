/**
 * API Client for Backend Communication
 * 
 * Provides typed interfaces and functions to communicate with the
 * Signal Equalizer FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface SeparatedSource {
  audio_shape: number[];
  audio_data: number[][];
  spectrogram?: string; // Base64 encoded image
}

export interface SeparationResult {
  sample_rate: number;
  sources: {
    drums: SeparatedSource;
    bass: SeparatedSource;
    vocals: SeparatedSource;
    other: SeparatedSource;
  };
  mixture_spectrogram?: string; // Base64 encoded image
}

export interface APIError {
  error: string;
  message: string;
  detail?: string;
}

/**
 * Upload and separate an audio file
 */
export async function separateAudio(
  file: File,
  segment: number = 10.0,
  overlap: number = 0.1
): Promise<SeparationResult> {
  const formData = new FormData();
  formData.append('file', file);

  const url = new URL('/api/audio/separate', API_BASE_URL);
  url.searchParams.append('segment', segment.toString());
  url.searchParams.append('overlap', overlap.toString());

  // Create AbortController for timeout (5 minutes for AI processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.detail || error.message || 'Failed to separate audio');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. AI processing is taking longer than expected (>5 minutes).');
    }
    throw error;
  }
}

/**
 * Process the demo sample audio
 */
export async function processSampleAudio(
  segment: number = 10.0,
  overlap: number = 0.1
): Promise<SeparationResult> {
  const url = new URL('/api/audio/sample', API_BASE_URL);
  url.searchParams.append('segment', segment.toString());
  url.searchParams.append('overlap', overlap.toString());

  // Create AbortController for timeout (5 minutes for AI processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.detail || error.message || 'Failed to process sample audio');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. AI processing is taking longer than expected (>5 minutes).');
    }
    throw error;
  }
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);
  
  if (!response.ok) {
    throw new Error('Backend health check failed');
  }
  
  return response.json();
}

/**
 * Get API info
 */
export async function getAPIInfo(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/info`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch API info');
  }
  
  return response.json();
}

/**
 * Convert Float32Array audio data to WAV blob for playback
 */
export function audioArrayToWav(audioData: number[][], sampleRate: number): Blob {
  const numChannels = audioData.length;
  const length = audioData[0].length;
  
  // Create WAV file buffer
  const buffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioData[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}
