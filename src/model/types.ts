// Audio processing types
export interface AudioData {
  buffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  numberOfChannels: number;
}

export interface BandWindow {
  f_start_hz: number;
  f_end_hz: number;
}

// Frequency band for equalizer
export interface FrequencyBand {
  id: string;
  label: string;
  frequency: number;
  gain: number;
  range: [number, number];
}

// Equalizer mode configuration
export interface EqualizerMode {
  name: string;
  description: string;
  bands: FrequencyBand[];
}

// Customized mode slider specification (multi-window)
export interface SliderSpec {
  id: string;
  label: string;
  defaultScale: number; // Linear gain [0.0 - 2.0]
  windows: BandWindow[];
}

// Customized mode configuration
export interface CustomizedMode {
  name: string;
  description: string;
  sliders: SliderSpec[];
}

// Discriminated union for mode types
export type EqualizerModeType = 'preset' | 'generic' | 'custom';

// Current customized mode state (slider values)
export interface CustomModeState {
  modeId: string;
  sliders: Map<string, number>; // slider id -> current scale
}

// Spectrogram data
export interface SpectrogramData {
  data: number[][];
  frequencyBins: number[];
  timeSteps: number[];
  maxMagnitude: number;
}

// Playback state
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number; // Speed multiplier (0.5x, 1x, 1.5x, 2x)
}

// Waveform view range (in seconds for time-based navigation)
export interface WaveformViewRange {
  startTime: number; // Start of visible range in seconds
  endTime: number;   // End of visible range in seconds
  zoomLevel: number; // Zoom level multiplier (1.0 = full view)
}

export interface BandSpec {
  windows: BandWindow[]; // one or more windows a band covers
  scale: number;         // product-applied linear gain (e.g. 0.5, 1.2)
}

// STFT configuration
export interface STFTOptions {
  windowSize: number; // analysis/synthesis window length
  hopSize: number;    // step between consecutive frames
  fftSize: number;    // FFT length (typically = windowSize)
}