/**
 * Audio playback utilities
 */

import { FrequencyBand } from '../model/types';

/**
 * Audio playback controller
 */
export class AudioPlayback {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private filters: BiquadFilterNode[] = [];
  private buffer: AudioBuffer | null = null;
  private startTime: number = 0;
  private pauseTime: number = 0;
  private isPlaying: boolean = false;

    // Load raw Float32 samples into the player (keeps EQ/controls)
  async loadFromFloat32(samples: Float32Array, sampleRate: number): Promise<void> {
    this.initialize();
    if (!this.audioContext) return;
    const buffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    this.setBuffer(buffer);
  }

  /**
   * Initialize audio context
   */
  initialize(): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
  }

  /**
   * Load audio buffer
   */
  setBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  /**
   * Apply equalizer settings
   */
  applyEqualizer(bands: FrequencyBand[]): void {
    if (!this.audioContext) return;

    // Remove existing filters
    this.filters.forEach(filter => filter.disconnect());
    this.filters = [];

    // Create new filters for each band
    bands.forEach(band => {
      if (!this.audioContext) return;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = band.frequency;
      filter.Q.value = 1.0;
      filter.gain.value = band.gain;

      this.filters.push(filter);
    });
  }

  /**
   * Start or resume playback
   */
  play(): void {
    if (!this.audioContext || !this.buffer) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Stop existing source if any
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {
        // Ignore errors if already stopped
      }
    }

    // Create new source node (required for each playback)
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.buffer;

    // Create gain node
    this.gainNode = this.audioContext.createGain();

    // Connect audio graph
    let currentNode: AudioNode = this.sourceNode;

    // Connect filters in series
    this.filters.forEach(filter => {
      currentNode.connect(filter);
      currentNode = filter;
    });

    // Connect to gain and output
    currentNode.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Start playback from pause time
    this.sourceNode.start(0, this.pauseTime);
    this.startTime = this.audioContext.currentTime - this.pauseTime;
    this.isPlaying = true;
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.audioContext || !this.sourceNode) return;

    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;
    this.isPlaying = false;
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.pauseTime = 0;
    this.startTime = 0;
    this.isPlaying = false;
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.audioContext) return 0;

    if (this.isPlaying) {
      return this.audioContext.currentTime - this.startTime;
    } else {
      return this.pauseTime;
    }
  }

  /**
   * Seek to specific time
   */
  seek(time: number): void {
    const wasPlaying = this.isPlaying;
    
    if (this.isPlaying) {
      this.pause();
    }
    
    this.pauseTime = time;
    
    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Check if currently playing
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}


// Standalone quick-play helper (no EQ/seek/pause)
export async function playFloat32(
  samples: Float32Array,
  sampleRate: number
) {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  buffer.getChannelData(0).set(samples);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  await ctx.resume();
  src.start();
  return { ctx, src };
}
