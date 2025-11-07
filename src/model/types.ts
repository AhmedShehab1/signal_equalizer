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