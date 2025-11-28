/**
 * DualSpectrogram - Input and Output Spectrograms with Toggle
 * Shows real-time frequency analysis for both input and processed signals
 * TICKET 2: Added zoom/pan with chartjs-plugin-zoom and auto-fit to signal
 * NEW: Added spectrogram visualization (time-frequency heatmap)
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line } from 'react-chartjs-2';
import { stftFrames } from '../lib/stft';
import { STFTOptions } from '../model/types';
import { Complex } from '../lib/fft';
import './DualSpectrogram.css';

// Register Chart.js components including zoom plugin
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

export type ScaleType = 'linear' | 'logarithmic';
export type VisualizationType = 'spectrum' | 'spectrogram';

interface DualSpectrogramProps {
  inputBuffer: AudioBuffer | null;
  outputBuffer: AudioBuffer | null;
  /** If true, spectrograms are visible */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Chart height in pixels */
  height?: number;
  /** TICKET 2: If true, auto-fit Y-axis on first load */
  autoFitOnLoad?: boolean;
}

// Constants
const LOG_MIN_FREQ = 20;
const STFT_OPTIONS: STFTOptions = {
  windowSize: 2048,
  hopSize: 512,
  fftSize: 2048,
};

// Color themes for input/output
const INPUT_THEME = {
  primary: 'rgba(0, 245, 255, 1)',
  secondary: 'rgba(0, 245, 255, 0.3)',
  gradient: ['rgba(0, 245, 255, 0.8)', 'rgba(0, 150, 200, 0.4)', 'rgba(0, 100, 150, 0.1)'],
};

const OUTPUT_THEME = {
  primary: 'rgba(168, 85, 247, 1)',
  secondary: 'rgba(168, 85, 247, 0.3)',
  gradient: ['rgba(168, 85, 247, 0.8)', 'rgba(120, 60, 180, 0.4)', 'rgba(80, 40, 130, 0.1)'],
};

const DEFAULT_Y_DOMAIN = { min: -90, max: 100 };

interface SpectrumData {
  magnitudes: Float32Array;
  frequencies: Float32Array;
}

// Spectrogram data: 2D array of magnitudes (time x frequency)
interface SpectrogramData {
  frames: Float32Array[]; // Each frame is magnitude values for frequency bins
  numBins: number;
  numFrames: number;
  sampleRate: number;
  duration: number;
}

// Helper function to format frequency labels
function formatFrequencyLabel(freq: number, detailed = false): string {
  if (freq >= 1000) {
    const kHz = freq / 1000;
    if (detailed) {
      return `${kHz.toFixed(kHz % 1 === 0 ? 0 : 1)} kHz`;
    }
    return `${kHz >= 10 ? Math.round(kHz) : kHz.toFixed(1)}k`;
  }
  return detailed ? `${Math.round(freq)} Hz` : `${Math.round(freq)}`;
}

// Compute spectrum data from an AudioBuffer
async function computeSpectrum(buffer: AudioBuffer): Promise<SpectrumData> {
  const signal = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  const frames = await stftFrames(signal, STFT_OPTIONS, sampleRate);
  
  const numBins = Math.floor(STFT_OPTIONS.fftSize / 2) + 1;
  const avgMagnitudes = new Float32Array(numBins);
  const frequencies = new Float32Array(numBins);
  
  // Calculate average magnitude in dB for each frequency bin
  for (let bin = 0; bin < numBins; bin++) {
    let sumMag = 0;
    for (const frame of frames) {
      const mag = Math.sqrt(frame[bin].re ** 2 + frame[bin].im ** 2);
      sumMag += mag;
    }
    const avgMag = sumMag / frames.length;
    avgMagnitudes[bin] = avgMag > 0 ? Math.max(-80, 20 * Math.log10(avgMag)) : -80;
    frequencies[bin] = (bin * sampleRate) / STFT_OPTIONS.fftSize;
  }
  
  return { magnitudes: avgMagnitudes, frequencies };
}

// Compute spectrogram data from an AudioBuffer (returns magnitude frames over time)
async function computeSpectrogram(buffer: AudioBuffer): Promise<SpectrogramData> {
  const signal = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  
  const frames = await stftFrames(signal, STFT_OPTIONS, sampleRate);
  const numBins = Math.floor(STFT_OPTIONS.fftSize / 2) + 1;
  
  // Convert each STFT frame to magnitude in dB
  const magnitudeFrames: Float32Array[] = frames.map((frame: Complex[]) => {
    const mags = new Float32Array(numBins);
    for (let bin = 0; bin < numBins; bin++) {
      const mag = Math.sqrt(frame[bin].re ** 2 + frame[bin].im ** 2);
      mags[bin] = mag > 0 ? Math.max(-100, 20 * Math.log10(mag)) : -100;
    }
    return mags;
  });
  
  return {
    frames: magnitudeFrames,
    numBins,
    numFrames: magnitudeFrames.length,
    sampleRate,
    duration: buffer.duration,
  };
}

// Color map for spectrogram (magnitude dB -> RGB)
function magnitudeToColor(dB: number, minDb: number, maxDb: number): [number, number, number] {
  // Normalize to 0-1 range
  const normalized = Math.max(0, Math.min(1, (dB - minDb) / (maxDb - minDb)));
  
  // "Inferno" inspired colormap: black -> purple -> red -> orange -> yellow -> white
  if (normalized < 0.2) {
    const t = normalized / 0.2;
    return [
      Math.floor(t * 80),
      Math.floor(t * 20),
      Math.floor(t * 100),
    ];
  } else if (normalized < 0.4) {
    const t = (normalized - 0.2) / 0.2;
    return [
      Math.floor(80 + t * 120),
      Math.floor(20 + t * 30),
      Math.floor(100 - t * 50),
    ];
  } else if (normalized < 0.6) {
    const t = (normalized - 0.4) / 0.2;
    return [
      Math.floor(200 + t * 55),
      Math.floor(50 + t * 80),
      Math.floor(50 - t * 50),
    ];
  } else if (normalized < 0.8) {
    const t = (normalized - 0.6) / 0.2;
    return [
      255,
      Math.floor(130 + t * 80),
      Math.floor(t * 50),
    ];
  } else {
    const t = (normalized - 0.8) / 0.2;
    return [
      255,
      Math.floor(210 + t * 45),
      Math.floor(50 + t * 205),
    ];
  }
}

// Draw spectrogram on a canvas
function drawSpectrogram(
  canvas: HTMLCanvasElement,
  data: SpectrogramData,
  minDb: number = -80,
  maxDb: number = 0
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const { frames, numBins, numFrames } = data;
  
  // Set canvas size
  const width = canvas.clientWidth || 400;
  const height = canvas.clientHeight || 200;
  canvas.width = width;
  canvas.height = height;
  
  // Create image data
  const imageData = ctx.createImageData(width, height);
  const pixels = imageData.data;
  
  // Scale factors
  const xScale = numFrames / width;
  const yScale = numBins / height;
  
  for (let x = 0; x < width; x++) {
    const frameIdx = Math.min(numFrames - 1, Math.floor(x * xScale));
    const frame = frames[frameIdx];
    
    for (let y = 0; y < height; y++) {
      // Y=0 is top of canvas, but we want low frequencies at bottom
      const binIdx = Math.min(numBins - 1, Math.floor((height - 1 - y) * yScale));
      const mag = frame[binIdx];
      const [r, g, b] = magnitudeToColor(mag, minDb, maxDb);
      
      const pixelIdx = (y * width + x) * 4;
      pixels[pixelIdx] = r;
      pixels[pixelIdx + 1] = g;
      pixels[pixelIdx + 2] = b;
      pixels[pixelIdx + 3] = 255;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

export default function DualSpectrogram({
  inputBuffer,
  outputBuffer,
  visible = true,
  onVisibilityChange,
  height = 200,
  autoFitOnLoad = false,
}: DualSpectrogramProps) {
  const [inputSpectrum, setInputSpectrum] = useState<SpectrumData | null>(null);
  const [outputSpectrum, setOutputSpectrum] = useState<SpectrumData | null>(null);
  const [scaleType, setScaleType] = useState<ScaleType>('logarithmic');
  const [isComputing, setIsComputing] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isAutoFit, setIsAutoFit] = useState(autoFitOnLoad);
  const [yDomain, setYDomain] = useState(DEFAULT_Y_DOMAIN);
  
  // Spectrogram state
  const [visualizationType, setVisualizationType] = useState<VisualizationType>('spectrum');
  const [inputSpectrogram, setInputSpectrogram] = useState<SpectrogramData | null>(null);
  const [outputSpectrogram, setOutputSpectrogram] = useState<SpectrogramData | null>(null);
  
  const inputChartRef = useRef<ChartJS<'line'>>(null);
  const outputChartRef = useRef<ChartJS<'line'>>(null);
  const overlayChartRef = useRef<ChartJS<'line'>>(null);
  const hasAutoFittedRef = useRef(false);
  
  // Canvas refs for spectrogram rendering
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const outputCanvasRef = useRef<HTMLCanvasElement>(null);

  // Compute input spectrum and spectrogram when buffer changes
  useEffect(() => {
    if (!inputBuffer) {
      setInputSpectrum(null);
      setInputSpectrogram(null);
      hasAutoFittedRef.current = false; // Reset for next file
      setYDomain(DEFAULT_Y_DOMAIN);
      setIsAutoFit(autoFitOnLoad);
      return;
    }
    
    setIsComputing(true);
    
    // Compute both spectrum and spectrogram in parallel
    Promise.all([
      computeSpectrum(inputBuffer),
      computeSpectrogram(inputBuffer),
    ])
      .then(([spectrum, spectrogram]) => {
        setInputSpectrum(spectrum);
        setInputSpectrogram(spectrogram);
      })
      .catch(console.error)
      .finally(() => setIsComputing(false));
  }, [inputBuffer]);


  // Compute output spectrum and spectrogram when buffer changes
  useEffect(() => {
    if (!outputBuffer) {
      setOutputSpectrum(null);
      setOutputSpectrogram(null);
      return;
    }
    
    Promise.all([
      computeSpectrum(outputBuffer),
      computeSpectrogram(outputBuffer),
    ])
      .then(([spectrum, spectrogram]) => {
        setOutputSpectrum(spectrum);
        setOutputSpectrogram(spectrogram);
      })
      .catch(console.error);
  }, [outputBuffer]);

  // Process data based on scale type
  const processData = useCallback((spectrum: SpectrumData | null, sampleRate: number) => {
    if (!spectrum) return null;
    
    const magArray = Array.from(spectrum.magnitudes);
    const freqArray = Array.from(spectrum.frequencies);
    const nyquist = sampleRate / 2;
    
    // Filter valid frequencies
    const validIndices: number[] = [];
    for (let i = 0; i < freqArray.length; i++) {
      if (freqArray[i] >= LOG_MIN_FREQ && freqArray[i] <= nyquist) {
        validIndices.push(i);
      }
    }
    
    if (scaleType === 'logarithmic') {
      const numPoints = 256;
      const logMin = Math.log10(LOG_MIN_FREQ);
      const logMax = Math.log10(nyquist);
      const logStep = (logMax - logMin) / (numPoints - 1);
      
      const logData: { freq: number; mag: number }[] = [];
      
      for (let i = 0; i < numPoints; i++) {
        const targetFreq = Math.pow(10, logMin + i * logStep);
        
        let lowerIdx = 0;
        let upperIdx = freqArray.length - 1;
        
        for (let j = 0; j < freqArray.length - 1; j++) {
          if (freqArray[j] <= targetFreq && freqArray[j + 1] > targetFreq) {
            lowerIdx = j;
            upperIdx = j + 1;
            break;
          }
        }
        
        const f0 = freqArray[lowerIdx];
        const f1 = freqArray[upperIdx];
        const m0 = magArray[lowerIdx];
        const m1 = magArray[upperIdx];
        
        let interpolatedMag: number;
        if (f1 !== f0) {
          const t = (targetFreq - f0) / (f1 - f0);
          interpolatedMag = m0 * (1 - t) + m1 * t;
        } else {
          interpolatedMag = m0;
        }
        
        logData.push({ freq: targetFreq, mag: interpolatedMag });
      }
      
      return {
        labels: logData.map(d => formatFrequencyLabel(d.freq)),
        data: logData.map(d => d.mag),
        frequencies: logData.map(d => d.freq),
      };
    } else {
      const maxPoints = 512;
      const step = Math.max(1, Math.floor(validIndices.length / maxPoints));
      
      const sampledLabels: string[] = [];
      const sampledData: number[] = [];
      const sampledFreqs: number[] = [];
      
      for (let i = 0; i < validIndices.length; i += step) {
        const idx = validIndices[i];
        sampledLabels.push(formatFrequencyLabel(freqArray[idx]));
        sampledData.push(magArray[idx]);
        sampledFreqs.push(freqArray[idx]);
      }
      
      return {
        labels: sampledLabels,
        data: sampledData,
        frequencies: sampledFreqs,
      };
    }
  }, [scaleType]);

  const sampleRate = inputBuffer?.sampleRate || 44100;
  const inputProcessed = useMemo(() => processData(inputSpectrum, sampleRate), [inputSpectrum, sampleRate, processData]);
  const outputProcessed = useMemo(() => processData(outputSpectrum, sampleRate), [outputSpectrum, sampleRate, processData]);

  const allMagnitudes = useMemo(() => {
    const values: number[] = [];
    if (inputProcessed) {
      values.push(...inputProcessed.data);
    }
    if (outputProcessed) {
      values.push(...outputProcessed.data);
    }
    return values;
  }, [inputProcessed, outputProcessed]);

  // Chart options factory with zoom/pan support
  const createChartOptions = useCallback((theme: typeof INPUT_THEME, frequencies: number[], domain: typeof DEFAULT_Y_DOMAIN): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 150 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        titleColor: theme.primary,
        bodyColor: '#ffffff',
        borderColor: theme.primary,
        borderWidth: 1,
        cornerRadius: 6,
        padding: 8,
        displayColors: false,
        callbacks: {
          title: (items) => {
            if (items.length > 0) {
              const idx = items[0].dataIndex;
              const freq = frequencies[idx];
              return formatFrequencyLabel(freq, true);
            }
            return '';
          },
          label: (item) => {
            const value = item.parsed.y ?? 0;
            return `${value.toFixed(1)} dB`;
          },
        },
      },
      // TICKET 2: Add zoom/pan for split view charts
      zoom: {
        pan: {
          enabled: true,
          mode: 'xy',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          drag: {
            enabled: true,
            backgroundColor: 'rgba(0, 245, 255, 0.1)',
            borderColor: theme.primary,
            borderWidth: 1,
          },
          mode: 'xy',
        },
        limits: {
          y: { min: -120, max: 20 }, // Extended range for hot signals
        },
      },
    },
    scales: {
      x: {
        type: 'category',
        display: true,
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          font: { size: 9 },
        },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      y: {
        type: 'linear',
        display: true,
        ticks: {
          color: 'rgba(255, 255, 255, 0.5)',
          font: { size: 9 },
        },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        min: domain.min,
        max: domain.max,
      },
    },
  }), []);

  // Chart data factory
  const createChartData = useCallback((processed: typeof inputProcessed, theme: typeof INPUT_THEME): ChartData<'line'> => {
    if (!processed) {
      return { labels: [], datasets: [] };
    }
    
    return {
      labels: processed.labels,
      datasets: [{
        label: 'Magnitude (dB)',
        data: processed.data,
        borderColor: theme.primary,
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return theme.secondary;
          
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, theme.gradient[0]);
          gradient.addColorStop(0.5, theme.gradient[1]);
          gradient.addColorStop(1, theme.gradient[2]);
          return gradient;
        },
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.5,
      }],
    };
  }, []);

  // Overlay chart data (both signals on one chart)
  const overlayChartData = useMemo((): ChartData<'line'> => {
    if (!inputProcessed) {
      return { labels: [], datasets: [] };
    }
    
    const datasets: ChartData<'line'>['datasets'] = [
      {
        label: 'Input',
        data: inputProcessed.data,
        borderColor: INPUT_THEME.primary,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ];
    
    if (outputProcessed) {
      datasets.push({
        label: 'Output',
        data: outputProcessed.data,
        borderColor: OUTPUT_THEME.primary,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      });
    }
    
    return {
      labels: inputProcessed.labels,
      datasets,
    };
  }, [inputProcessed, outputProcessed]);

  // Compute Y-axis min/max from data for auto-fit
  const computeYAxisLimits = useCallback((data: number[]): { min: number; max: number } => {
    if (data.length === 0) return { min: -80, max: 0 };
    
    let min = Math.min(...data);
    let max = Math.max(...data);
    
    // Add 10% padding for better visibility
    const range = max - min || 10;
    min = Math.max(-100, min - range * 0.1);
    max = Math.min(20, max + range * 0.1); // TICKET 2: Allow up to +20dB for hot signals
    
    // Ensure minimum visible range
    if (max - min < 20) {
      const center = (min + max) / 2;
      min = center - 10;
      max = center + 10;
    }
    
    return { min, max };
  }, []);

  // Auto-fit once when requested and data available
  useEffect(() => {
    if (!autoFitOnLoad || hasAutoFittedRef.current) return;
    if (allMagnitudes.length === 0) return;
    setIsAutoFit(true);
    setYDomain(computeYAxisLimits(allMagnitudes));
    hasAutoFittedRef.current = true;
  }, [autoFitOnLoad, allMagnitudes, computeYAxisLimits]);

  // Keep auto-fit domain updated as new spectra arrive
  useEffect(() => {
    if (!isAutoFit) return;
    if (allMagnitudes.length === 0) return;
    const nextDomain = computeYAxisLimits(allMagnitudes);
    setYDomain(prev => {
      const delta = Math.abs(prev.min - nextDomain.min) + Math.abs(prev.max - nextDomain.max);
      return delta > 0.5 ? nextDomain : prev;
    });
  }, [isAutoFit, allMagnitudes, computeYAxisLimits]);

  // Draw spectrograms when in spectrogram mode and data is available
  useEffect(() => {
    if (visualizationType !== 'spectrogram' || showOverlay) return;
    
    if (inputCanvasRef.current && inputSpectrogram) {
      drawSpectrogram(inputCanvasRef.current, inputSpectrogram, yDomain.min, yDomain.max);
    }
    if (outputCanvasRef.current && outputSpectrogram) {
      drawSpectrogram(outputCanvasRef.current, outputSpectrogram, yDomain.min, yDomain.max);
    }
  }, [visualizationType, showOverlay, inputSpectrogram, outputSpectrogram, yDomain]);

  // Reset zoom on all charts
  const handleResetZoom = useCallback(() => {
    overlayChartRef.current?.resetZoom();
    inputChartRef.current?.resetZoom();
    outputChartRef.current?.resetZoom();
    setIsAutoFit(false);
    setYDomain(DEFAULT_Y_DOMAIN);
  }, []);

  // Auto-fit to signal range
  const handleAutoFit = useCallback(() => {
    if (allMagnitudes.length === 0) {
      setYDomain(DEFAULT_Y_DOMAIN);
      setIsAutoFit(false);
      return;
    }
    setIsAutoFit(true);
    setYDomain(computeYAxisLimits(allMagnitudes));
  }, [allMagnitudes, computeYAxisLimits]);

  const overlayChartOptions = useMemo((): ChartOptions<'line'> => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: 'rgba(255, 255, 255, 0.8)',
            boxWidth: 12,
            padding: 15,
            font: { size: 11 },
          },
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          cornerRadius: 6,
          padding: 10,
        },
        // TICKET 2: Add zoom/pan plugin configuration
        zoom: {
          pan: {
            enabled: true,
            mode: 'xy',
            modifierKey: 'shift', // Hold shift to pan
          },
          zoom: {
            wheel: {
              enabled: true,
              modifierKey: 'ctrl', // Hold ctrl/cmd to zoom with wheel
            },
            pinch: {
              enabled: true,
            },
            drag: {
              enabled: true,
              backgroundColor: 'rgba(0, 245, 255, 0.1)',
              borderColor: 'rgba(0, 245, 255, 0.5)',
              borderWidth: 1,
            },
            mode: 'xy',
          },
          limits: {
            y: { min: -120, max: 20 }, // Extended range for hot signals
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          display: true,
          title: {
            display: true,
            text: scaleType === 'logarithmic' ? 'Frequency (Log)' : 'Frequency (Linear)',
            color: 'rgba(255, 255, 255, 0.6)',
            font: { size: 10 },
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
            font: { size: 9 },
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        y: {
          type: 'linear',
          display: true,
          title: {
            display: true,
            text: 'Magnitude (dB)',
            color: 'rgba(255, 255, 255, 0.6)',
            font: { size: 10 },
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.5)',
            font: { size: 9 },
          },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          min: yDomain.min,
          max: yDomain.max,
        },
      },
    };
  }, [scaleType, yDomain]);

  const handleToggle = useCallback(() => {
    onVisibilityChange?.(!visible);
  }, [visible, onVisibilityChange]);

  if (!visible) {
    return (
      <div className="dual-spectrogram-collapsed">
        <button className="toggle-btn" onClick={handleToggle}>
          <span className="toggle-icon">📊</span>
          <span>Show Spectrograms</span>
        </button>
      </div>
    );
  }

  return (
    <div className="dual-spectrogram">
      <div className="spectrogram-header">
        <div className="header-left">
          <h4>
            <span className="title-icon">📊</span>
            Frequency Spectrum
          </h4>
          {isComputing && <span className="computing-badge">Computing...</span>}
        </div>
        
        <div className="header-controls">
          {/* Zoom controls - TICKET 2 */}
          <div className="zoom-controls">
            <button
              className="zoom-btn"
              onClick={handleAutoFit}
              title="Fit to signal range"
            >
              📐 Fit
            </button>
            <button
              className="zoom-btn"
              onClick={handleResetZoom}
              title="Reset zoom to default"
            >
              🔄 Reset
            </button>
          </div>
          
          {/* Visualization type toggle - only visible in Split mode */}
          {!showOverlay && (
            <div className="viz-toggle">
              <button
                className={`viz-btn ${visualizationType === 'spectrum' ? 'active' : ''}`}
                onClick={() => setVisualizationType('spectrum')}
                title="Frequency spectrum (magnitude vs frequency)"
              >
                📈 Spectrum
              </button>
              <button
                className={`viz-btn ${visualizationType === 'spectrogram' ? 'active' : ''}`}
                onClick={() => setVisualizationType('spectrogram')}
                title="Spectrogram (time-frequency heatmap)"
              >
                🌡️ Spectrogram
              </button>
            </div>
          )}
          
          {/* View mode toggle */}
          <div className="view-toggle">
            <button
              className={`view-btn ${showOverlay ? 'active' : ''}`}
              onClick={() => setShowOverlay(true)}
              title="Overlay view"
            >
              Overlay
            </button>
            <button
              className={`view-btn ${!showOverlay ? 'active' : ''}`}
              onClick={() => setShowOverlay(false)}
              title="Split view"
            >
              Split
            </button>
          </div>
          
          {/* Scale toggle */}
          <div className="scale-toggle">
            <button
              className={`scale-btn ${scaleType === 'linear' ? 'active' : ''}`}
              onClick={() => setScaleType('linear')}
            >
              Linear
            </button>
            <button
              className={`scale-btn ${scaleType === 'logarithmic' ? 'active' : ''}`}
              onClick={() => setScaleType('logarithmic')}
            >
              Log
            </button>
          </div>
          
          {/* Visibility toggle */}
          <button className="hide-btn" onClick={handleToggle} title="Hide spectrograms">
            <span>👁‍🗨</span>
          </button>
        </div>
      </div>
      
      {showOverlay ? (
        /* Overlay View - Both signals on one chart */
        <div className="spectrogram-overlay" style={{ height }}>
          {inputProcessed ? (
            <Line ref={overlayChartRef} data={overlayChartData} options={overlayChartOptions} />
          ) : (
            <div className="spectrogram-empty">
              <span>Load an audio file to see the frequency spectrum</span>
            </div>
          )}
        </div>
      ) : (
        /* Split View - Side by side */
        <div className="spectrogram-split">
          <div className="spectrogram-panel input-panel">
            <div className="panel-label">
              <span className="dot input-dot"></span>
              Input Signal
            </div>
            <div className="chart-container" style={{ height: height - 24 }}>
              {visualizationType === 'spectrum' ? (
                inputProcessed ? (
                  <Line
                    ref={inputChartRef}
                    data={createChartData(inputProcessed, INPUT_THEME)}
                    options={createChartOptions(INPUT_THEME, inputProcessed.frequencies, yDomain)}
                  />
                ) : (
                  <div className="spectrogram-empty">No input</div>
                )
              ) : (
                inputSpectrogram ? (
                  <div className="spectrogram-canvas-container">
                    <canvas 
                      ref={inputCanvasRef} 
                      className="spectrogram-canvas"
                    />
                    <div className="spectrogram-axis-labels">
                      <span className="axis-label y-top">{formatFrequencyLabel(inputSpectrogram.sampleRate / 2, true)}</span>
                      <span className="axis-label y-bottom">0 Hz</span>
                      <span className="axis-label x-left">0s</span>
                      <span className="axis-label x-right">{inputSpectrogram.duration.toFixed(2)}s</span>
                    </div>
                  </div>
                ) : (
                  <div className="spectrogram-empty">No input</div>
                )
              )}
            </div>
          </div>
          
          <div className="spectrogram-panel output-panel">
            <div className="panel-label">
              <span className="dot output-dot"></span>
              Output Signal (EQ Applied)
            </div>
            <div className="chart-container" style={{ height: height - 24 }}>
              {visualizationType === 'spectrum' ? (
                outputProcessed ? (
                  <Line
                    ref={outputChartRef}
                    data={createChartData(outputProcessed, OUTPUT_THEME)}
                    options={createChartOptions(OUTPUT_THEME, outputProcessed.frequencies, yDomain)}
                  />
                ) : (
                  <div className="spectrogram-empty">
                    {inputBuffer ? 'Apply EQ to see output' : 'No output'}
                  </div>
                )
              ) : (
                outputSpectrogram ? (
                  <div className="spectrogram-canvas-container">
                    <canvas 
                      ref={outputCanvasRef} 
                      className="spectrogram-canvas"
                    />
                    <div className="spectrogram-axis-labels">
                      <span className="axis-label y-top">{formatFrequencyLabel(outputSpectrogram.sampleRate / 2, true)}</span>
                      <span className="axis-label y-bottom">0 Hz</span>
                      <span className="axis-label x-left">0s</span>
                      <span className="axis-label x-right">{outputSpectrogram.duration.toFixed(2)}s</span>
                    </div>
                  </div>
                ) : (
                  <div className="spectrogram-empty">
                    {inputBuffer ? 'Apply EQ to see output' : 'No output'}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="spectrogram-footer">
        <span className="info-text">
          {!showOverlay && visualizationType === 'spectrogram' ? (
            <>
              🌡️ Spectrogram
              {' · '}
              X: Time · Y: Frequency · Color: Amplitude
              {' · '}
              {yDomain.min.toFixed(0)} to {yDomain.max.toFixed(0)} dB
            </>
          ) : (
            <>
              {scaleType === 'logarithmic' ? '📐 Log' : '📏 Linear'}
              {' · '}
              {LOG_MIN_FREQ} Hz - {formatFrequencyLabel((sampleRate / 2), true)}
              {' · '}
              <span className="zoom-hint">Drag to zoom • Scroll to zoom • Shift+drag to pan</span>
            </>
          )}
        </span>
        <span className="sample-rate">Fs: {sampleRate} Hz</span>
      </div>
    </div>
  );
}
