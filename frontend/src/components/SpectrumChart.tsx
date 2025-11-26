/**
 * SpectrumChart - FFT Visualization with Linear/Audiogram Scale Toggle
 * Uses react-chartjs-2 for interactive frequency spectrum display
 */

import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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
import './SpectrumChart.css';

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

interface SpectrumChartProps {
  /** FFT magnitude data array */
  magnitudes: Float32Array | number[];
  /** Corresponding frequency bins in Hz */
  frequencies: Float32Array | number[];
  /** Sample rate of the audio */
  sampleRate: number;
  /** Title for the chart */
  title?: string;
  /** Initial scale type */
  initialScale?: ScaleType;
  /** Optional: external control for scale type */
  scaleType?: ScaleType;
  /** Callback when scale changes */
  onScaleChange?: (scale: ScaleType) => void;
  /** Chart height in pixels */
  height?: number;
  /** Enable/disable chart interactivity */
  interactive?: boolean;
  /** Color theme: 'cyan' | 'magenta' | 'green' */
  colorTheme?: 'cyan' | 'magenta' | 'green';
}

// Minimum frequency for logarithmic scale (avoid log(0))
const LOG_MIN_FREQ = 20;

// Color palettes for different themes
const COLOR_THEMES = {
  cyan: {
    primary: 'rgba(0, 245, 255, 1)',
    secondary: 'rgba(0, 245, 255, 0.3)',
    gradient: ['rgba(0, 245, 255, 0.8)', 'rgba(0, 150, 200, 0.4)', 'rgba(0, 100, 150, 0.1)'],
  },
  magenta: {
    primary: 'rgba(255, 0, 128, 1)',
    secondary: 'rgba(255, 0, 128, 0.3)',
    gradient: ['rgba(255, 0, 128, 0.8)', 'rgba(200, 0, 100, 0.4)', 'rgba(150, 0, 80, 0.1)'],
  },
  green: {
    primary: 'rgba(0, 255, 128, 1)',
    secondary: 'rgba(0, 255, 128, 0.3)',
    gradient: ['rgba(0, 255, 128, 0.8)', 'rgba(0, 200, 100, 0.4)', 'rgba(0, 150, 80, 0.1)'],
  },
};

export default function SpectrumChart({
  magnitudes,
  frequencies,
  sampleRate,
  title = 'Frequency Spectrum',
  initialScale = 'linear',
  scaleType: externalScaleType,
  onScaleChange,
  height = 300,
  interactive = true,
  colorTheme = 'cyan',
}: SpectrumChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);
  const [internalScaleType, setInternalScaleType] = useState<ScaleType>(initialScale);
  
  // Use external scale type if provided, otherwise use internal state
  const currentScale = externalScaleType ?? internalScaleType;
  
  const theme = COLOR_THEMES[colorTheme];

  // Handle scale toggle
  const handleScaleToggle = useCallback((newScale: ScaleType) => {
    if (externalScaleType === undefined) {
      setInternalScaleType(newScale);
    }
    onScaleChange?.(newScale);
  }, [externalScaleType, onScaleChange]);

  // Process data based on scale type
  const processedData = useMemo(() => {
    const magArray = Array.from(magnitudes);
    const freqArray = Array.from(frequencies);
    const nyquist = sampleRate / 2;
    
    // Filter out DC and very low frequencies, keep up to Nyquist
    const validIndices: number[] = [];
    for (let i = 0; i < freqArray.length; i++) {
      if (freqArray[i] >= LOG_MIN_FREQ && freqArray[i] <= nyquist) {
        validIndices.push(i);
      }
    }
    
    if (currentScale === 'logarithmic') {
      // Logarithmic scale: resample to logarithmically-spaced frequencies
      // This gives better resolution in lower frequencies (important for music/voice)
      const numPoints = 256; // Number of points on log scale
      const logMin = Math.log10(LOG_MIN_FREQ);
      const logMax = Math.log10(nyquist);
      const logStep = (logMax - logMin) / (numPoints - 1);
      
      const logData: { freq: number; mag: number }[] = [];
      
      for (let i = 0; i < numPoints; i++) {
        const targetFreq = Math.pow(10, logMin + i * logStep);
        
        // Find surrounding bins for interpolation
        let lowerIdx = 0;
        let upperIdx = freqArray.length - 1;
        
        for (let j = 0; j < freqArray.length - 1; j++) {
          if (freqArray[j] <= targetFreq && freqArray[j + 1] > targetFreq) {
            lowerIdx = j;
            upperIdx = j + 1;
            break;
          }
        }
        
        // Linear interpolation between bins
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
      // Linear scale: show all frequency bins up to Nyquist
      // Downsample if too many points for performance
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
  }, [magnitudes, frequencies, currentScale, sampleRate]);

  // Chart data configuration
  const chartData: ChartData<'line'> = useMemo(() => ({
    labels: processedData.labels,
    datasets: [
      {
        label: 'Magnitude (dB)',
        data: processedData.data,
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
        pointHoverRadius: 4,
        pointBackgroundColor: theme.primary,
        pointBorderColor: 'rgba(0, 0, 0, 0.5)',
        pointBorderWidth: 1,
        borderWidth: 2,
      },
    ],
  }), [processedData, theme, currentScale]);

  // Chart options
  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 300,
      easing: 'easeInOutQuart',
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false, // We use our own title
      },
      tooltip: {
        enabled: interactive,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: theme.primary,
        bodyColor: '#ffffff',
        borderColor: theme.primary,
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        displayColors: false,
        callbacks: {
          title: (items) => {
            if (items.length > 0) {
              const idx = items[0].dataIndex;
              const freq = processedData.frequencies[idx];
              return formatFrequencyLabel(freq, true);
            }
            return '';
          },
          label: (item) => {
            const value = item.parsed.y ?? 0;
            return `Magnitude: ${value.toFixed(2)} dB`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category',
        title: {
          display: true,
          text: currentScale === 'logarithmic' ? 'Frequency (Log Scale)' : 'Frequency (Linear)',
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 12,
            weight: 'bold',
          },
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
          font: {
            size: 10,
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          lineWidth: 1,
        },
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Magnitude (dB)',
          color: 'rgba(255, 255, 255, 0.7)',
          font: {
            size: 12,
            weight: 'bold',
          },
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)',
          font: {
            size: 10,
          },
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          lineWidth: 1,
        },
        min: -80,
        max: 0,
      },
    },
  }), [currentScale, processedData.frequencies, theme, interactive]);

  // Update chart when scale changes
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.update('none');
    }
  }, [currentScale]);

  return (
    <div className="spectrum-chart glass-panel">
      <div className="spectrum-chart-header">
        <h3 className="spectrum-chart-title">
          <span className="title-icon">📊</span>
          {title}
        </h3>
        
        <div className="scale-toggle-container">
          <span className="scale-label">Scale:</span>
          <div className="scale-toggle">
            <button
              className={`scale-btn ${currentScale === 'linear' ? 'active' : ''}`}
              onClick={() => handleScaleToggle('linear')}
              aria-pressed={currentScale === 'linear'}
            >
              <span className="scale-icon">📏</span>
              Linear
            </button>
            <button
              className={`scale-btn ${currentScale === 'logarithmic' ? 'active' : ''}`}
              onClick={() => handleScaleToggle('logarithmic')}
              aria-pressed={currentScale === 'logarithmic'}
            >
              <span className="scale-icon">📐</span>
              Logarithmic
            </button>
          </div>
        </div>
      </div>
      
      <div className="spectrum-chart-body" style={{ height }}>
        <Line
          ref={chartRef}
          data={chartData}
          options={chartOptions}
        />
      </div>
      
      <div className="spectrum-chart-footer">
        <div className="scale-info">
          {currentScale === 'logarithmic' ? (
            <span className="info-text">
              📐 Logarithmic: Better low-frequency resolution ({LOG_MIN_FREQ} Hz - {formatFrequencyLabel(sampleRate / 2)})
            </span>
          ) : (
            <span className="info-text">
              📏 Linear: Uniform frequency spacing ({LOG_MIN_FREQ} Hz - {formatFrequencyLabel(sampleRate / 2)})
            </span>
          )}
        </div>
        <div className="sample-rate-info">
          <span className="badge badge-secondary">Fs: {sampleRate} Hz</span>
        </div>
      </div>
    </div>
  );
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

export type { SpectrumChartProps };
