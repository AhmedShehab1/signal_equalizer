/**
 * DualSpectrogram - Input and Output Spectrograms with Toggle
 * Shows real-time frequency analysis for both input and processed signals
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
import { Line } from 'react-chartjs-2';
import { stftFrames } from '../lib/stft';
import { STFTOptions } from '../model/types';
import './DualSpectrogram.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export type ScaleType = 'linear' | 'logarithmic';

interface DualSpectrogramProps {
  inputBuffer: AudioBuffer | null;
  outputBuffer: AudioBuffer | null;
  /** If true, spectrograms are visible */
  visible?: boolean;
  /** Callback when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
  /** Chart height in pixels */
  height?: number;
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

interface SpectrumData {
  magnitudes: Float32Array;
  frequencies: Float32Array;
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

export default function DualSpectrogram({
  inputBuffer,
  outputBuffer,
  visible = true,
  onVisibilityChange,
  height = 200,
}: DualSpectrogramProps) {
  const [inputSpectrum, setInputSpectrum] = useState<SpectrumData | null>(null);
  const [outputSpectrum, setOutputSpectrum] = useState<SpectrumData | null>(null);
  const [scaleType, setScaleType] = useState<ScaleType>('logarithmic');
  const [isComputing, setIsComputing] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  
  const inputChartRef = useRef<ChartJS<'line'>>(null);
  const outputChartRef = useRef<ChartJS<'line'>>(null);

  // Compute input spectrum when buffer changes
  useEffect(() => {
    if (!inputBuffer) {
      setInputSpectrum(null);
      return;
    }
    
    setIsComputing(true);
    computeSpectrum(inputBuffer)
      .then(setInputSpectrum)
      .catch(console.error)
      .finally(() => setIsComputing(false));
  }, [inputBuffer]);

  // Compute output spectrum when buffer changes
  useEffect(() => {
    if (!outputBuffer) {
      setOutputSpectrum(null);
      return;
    }
    
    computeSpectrum(outputBuffer)
      .then(setOutputSpectrum)
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

  // Chart options factory
  const createChartOptions = useCallback((theme: typeof INPUT_THEME, frequencies: number[]): ChartOptions<'line'> => ({
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
        min: -80,
        max: 0,
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

  const overlayChartOptions = useMemo((): ChartOptions<'line'> => ({
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
        min: -80,
        max: 0,
      },
    },
  }), [scaleType]);

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
            <Line data={overlayChartData} options={overlayChartOptions} />
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
              {inputProcessed ? (
                <Line
                  ref={inputChartRef}
                  data={createChartData(inputProcessed, INPUT_THEME)}
                  options={createChartOptions(INPUT_THEME, inputProcessed.frequencies)}
                />
              ) : (
                <div className="spectrogram-empty">No input</div>
              )}
            </div>
          </div>
          
          <div className="spectrogram-panel output-panel">
            <div className="panel-label">
              <span className="dot output-dot"></span>
              Output Signal (EQ Applied)
            </div>
            <div className="chart-container" style={{ height: height - 24 }}>
              {outputProcessed ? (
                <Line
                  ref={outputChartRef}
                  data={createChartData(outputProcessed, OUTPUT_THEME)}
                  options={createChartOptions(OUTPUT_THEME, outputProcessed.frequencies)}
                />
              ) : (
                <div className="spectrogram-empty">
                  {inputBuffer ? 'Apply EQ to see output' : 'No output'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="spectrogram-footer">
        <span className="info-text">
          {scaleType === 'logarithmic' ? '📐 Logarithmic scale' : '📏 Linear scale'}
          {' · '}
          {LOG_MIN_FREQ} Hz - {formatFrequencyLabel((sampleRate / 2), true)}
        </span>
        <span className="sample-rate">Fs: {sampleRate} Hz</span>
      </div>
    </div>
  );
}
