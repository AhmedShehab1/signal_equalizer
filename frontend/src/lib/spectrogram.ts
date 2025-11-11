/**
 * Spectrogram generation and visualization utilities
 */

import { stft, magnitudeToDb } from './stft';
import { SpectrogramData, BandSpec } from '../model/types';

/**
 * Generate spectrogram data from audio signal
 * @param signal - Audio signal samples
 * @param sampleRate - Sample rate of the audio
 * @param windowSize - FFT window size
 * @param hopSize - Hop size between windows
 * @returns Spectrogram data
 */
export function generateSpectrogram(
  signal: number[],
  sampleRate: number,
  windowSize: number = 2048,
  hopSize: number = 512
): SpectrogramData {
  const stftResult = stft(signal, windowSize, hopSize, sampleRate);
  
  // Convert magnitudes to dB scale
  const dataDb = stftResult.magnitudes.map(frame =>
    frame.map(mag => magnitudeToDb(mag))
  );
  
  // Find max magnitude for normalization
  let maxMagnitude = -Infinity;
  for (const frame of dataDb) {
    for (const mag of frame) {
      if (mag > maxMagnitude && isFinite(mag)) {
        maxMagnitude = mag;
      }
    }
  }
  
  return {
    data: dataDb,
    frequencyBins: stftResult.frequencies,
    timeSteps: stftResult.times,
    maxMagnitude,
  };
}

/**
 * Render spectrogram to canvas
 * @param canvas - Canvas element to render to
 * @param spectrogramData - Spectrogram data
 */
export function renderSpectrogram(
  canvas: HTMLCanvasElement,
  spectrogramData: SpectrogramData
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const { data, maxMagnitude } = spectrogramData;
  const numTimeSteps = data.length;
  const numFreqBins = data[0]?.length || 0;
  
  // Set canvas size
  canvas.width = numTimeSteps;
  canvas.height = numFreqBins;
  
  // Create image data
  const imageData = ctx.createImageData(numTimeSteps, numFreqBins);
  
  for (let t = 0; t < numTimeSteps; t++) {
    for (let f = 0; f < numFreqBins; f++) {
      const magnitude = data[t][f];
      const normalized = (magnitude - (maxMagnitude - 80)) / 80; // 80 dB dynamic range
      const intensity = Math.max(0, Math.min(1, normalized));
      
      // Map to color (viridis-like colormap)
      const color = getSpectrogramColor(intensity);
      
      // Note: canvas y-axis is top to bottom, frequency is bottom to top
      const yInverted = numFreqBins - 1 - f;
      const idx = (yInverted * numTimeSteps + t) * 4;
      
      imageData.data[idx] = color.r;
      imageData.data[idx + 1] = color.g;
      imageData.data[idx + 2] = color.b;
      imageData.data[idx + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Get color for spectrogram visualization
 * @param value - Normalized value between 0 and 1
 * @returns RGB color
 */
function getSpectrogramColor(value: number): { r: number; g: number; b: number } {
  // Simple blue to red colormap
  const r = Math.floor(value * 255);
  const g = Math.floor(Math.sin(value * Math.PI) * 255);
  const b = Math.floor((1 - value) * 255);
  
  return { r, g, b };
}

export function buildGainVector(
  bands: BandSpec[],
  fftSize: number,
  sampleRate: number
): Float32Array {
  // Only up to Nyquist (inclusive)
  const nyquistBin = Math.floor(fftSize / 2);
  const gainVector = new Float32Array(nyquistBin + 1);
  gainVector.fill(1.0);

  const binToFreq = (i: number) => (i * sampleRate) / fftSize;

  for (let i = 0; i <= nyquistBin; i++) {
    const freq = binToFreq(i);
    let binGain = 1.0;

    for (const band of bands) {
      let inThisBand = false;

      // Support multi-window bands
      for (const window of band.windows) {
        if (freq >= window.f_start_hz && freq <= window.f_end_hz) {
          inThisBand = true;
          break;
        }
      }

      if (inThisBand) {
        binGain *= band.scale; // product rule
      }
    }

    gainVector[i] = binGain;
  }

  return gainVector;
}
