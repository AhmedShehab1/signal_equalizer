/**
 * API Client for Backend Communication
 * 
 * Provides typed interfaces and functions to communicate with the
 * Signal Equalizer FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ============================================================================
// Type Definitions
// ============================================================================

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

/**
 * Speech separation source with generic naming (Source 0, Source 1, etc.)
 */
export interface SpeechSource {
  audio_shape: number[];
  audio_data: number[];
  spectrogram?: string; // Base64 encoded image
}

/**
 * Speech separation result with variable number of sources
 */
export interface SpeechSeparationResult {
  sample_rate: number;
  num_sources: number;
  sources: {
    [key: string]: SpeechSource; // source_0, source_1, source_2, etc.
  };
  mixture_spectrogram?: string; // Base64 encoded image
}

export interface APIError {
  error: string;
  message: string;
  detail?: string;
}

// ============================================================================
// Music Source Separation (Demucs)
// ============================================================================

/**
 * Upload and separate an audio file into music sources (drums, bass, vocals, other)
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
 * Process the demo sample audio with Demucs (music separation)
 */
export async function processSampleAudio(
  segment: number = 5.0,
  overlap: number = 0.1,
  spectrograms: boolean = true
): Promise<SeparationResult> {
  const url = new URL('/api/audio/sample', API_BASE_URL);
  url.searchParams.append('segment', segment.toString());
  url.searchParams.append('overlap', overlap.toString());
  url.searchParams.append('spectrograms', spectrograms.toString());

  // Create AbortController for timeout (3 minutes for demo processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.detail || error.message || 'Failed to process demo sample');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Demo processing is taking longer than expected (>3 minutes).');
    }
    throw error;
  }
}

// ============================================================================
// Speech Source Separation (DPRNN)
// ============================================================================

/**
 * Upload and separate speech audio into individual speakers (Source 0, Source 1, etc.)
 * 
 * @param file - Audio file to process
 * @param maxDuration - Maximum duration to process in seconds (default: 8.0, range: 0-30)
 * @returns Promise with separated speech sources
 */
export async function separateSpeechAudio(
  file: File,
  maxDuration: number = 8.0
): Promise<SpeechSeparationResult> {
  const formData = new FormData();
  formData.append('file', file);

  const url = new URL('/api/audio/speech-separate', API_BASE_URL);
  url.searchParams.append('max_duration', maxDuration.toString());

  // Create AbortController for timeout (2 minutes for speech processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.detail || error.message || 'Failed to separate speech audio');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Speech processing is taking longer than expected (>2 minutes).');
    }
    throw error;
  }
}

/**
 * Process the demo speech sample with DPRNN (speech separation)
 * 
 * @param maxDuration - Maximum duration to process in seconds (default: 8.0, range: 0-30)
 * @param spectrograms - Whether to generate spectrograms (default: true)
 * @returns Promise with separated speech sources
 */
export async function processSpeechSample(
  maxDuration: number = 8.0,
  spectrograms: boolean = true
): Promise<SpeechSeparationResult> {
  const url = new URL('/api/audio/speech-sample', API_BASE_URL);
  url.searchParams.append('max_duration', maxDuration.toString());
  url.searchParams.append('spectrograms', spectrograms.toString());

  // Create AbortController for timeout (1 minute for demo processing)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: APIError = await response.json();
      throw new Error(error.detail || error.message || 'Failed to process speech demo sample');
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Speech demo processing is taking longer than expected (>1 minute).');
    }
    throw error;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

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
 * Handles both music (2D array) and speech (1D array) audio data
 * 
 * @param audioData - Audio data as 2D array (music) or 1D array (speech)
 * @param sampleRate - Sample rate of the audio
 * @returns WAV blob ready for playback
 */
export function audioArrayToWav(audioData: number[][] | number[], sampleRate: number): Blob {
  // Normalize input to 2D array format
  const channels: number[][] = Array.isArray(audioData[0]) 
    ? audioData as number[][]
    : [audioData as number[]]; // Convert 1D to 2D with single channel
  
  const numChannels = channels.length;
  const length = channels[0].length;
  
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
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Get user-friendly label for a source key
 * 
 * @param sourceKey - Source key (e.g., "drums", "source_0")
 * @returns User-friendly label (e.g., "Drums", "Source 1")
 */
export function getSourceLabel(sourceKey: string): string {
  // Speech sources: source_0, source_1, etc.
  if (sourceKey.startsWith('source_')) {
    const index = parseInt(sourceKey.split('_')[1]);
    return `Source ${index + 1}`; // Convert 0-indexed to 1-indexed for display
  }
  
  // Music sources: drums, bass, vocals, other
  return sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1);
}

/**
 * Check if a separation result is from speech separation (DPRNN)
 * 
 * @param result - Separation result (music or speech)
 * @returns true if speech separation, false if music separation
 */
export function isSpeechSeparation(
  result: SeparationResult | SpeechSeparationResult
): result is SpeechSeparationResult {
  return 'num_sources' in result;
}

/**
 * Get all source keys from a separation result
 * 
 * @param result - Separation result (music or speech)
 * @returns Array of source keys
 */
export function getSourceKeys(
  result: SeparationResult | SpeechSeparationResult
): string[] {
  return Object.keys(result.sources);
}
