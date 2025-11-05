// Audio processing types
export interface AudioData {
  buffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  numberOfChannels: number;
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
