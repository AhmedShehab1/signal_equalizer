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
  private playbackRate: number = 1.0;
  private subscribers: Set<(time: number) => void> = new Set();
  private animationFrameId: number | null = null;

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
   * Get the shared AudioContext instance
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Create an AudioBuffer using the shared context
   */
  createBuffer(numChannels: number, length: number, sampleRate: number): AudioBuffer | null {
    if (!this.audioContext) {
      this.initialize();
    }
    return this.audioContext ? this.audioContext.createBuffer(numChannels, length, sampleRate) : null;
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
    this.sourceNode.playbackRate.value = this.playbackRate;

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
    // Calculate startTime accounting for playback rate and pause position
    // startTime represents the audioContext time when we were at position 0
    this.startTime = this.audioContext.currentTime - (this.pauseTime / this.playbackRate);
    this.isPlaying = true;
    
    // Start notifying subscribers
    this.startTimeUpdates();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.audioContext || !this.sourceNode) return;

    // Calculate current audio position (accounting for playback rate)
    this.pauseTime = this.getCurrentTime();
    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;
    this.isPlaying = false;
    
    // Stop time updates
    this.stopTimeUpdates();
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
    
    // Stop time updates
    this.stopTimeUpdates();
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.audioContext) return 0;

    if (this.isPlaying) {
      // Calculate elapsed wall-clock time since playback started
      const wallClockElapsed = this.audioContext.currentTime - this.startTime;
      // Multiply by playback rate to get audio position
      // At 0.5× speed: 10 seconds wall-clock = 5 seconds audio
      // At 2× speed: 5 seconds wall-clock = 10 seconds audio
      return wallClockElapsed * this.playbackRate;
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
   * Set playback rate (speed)
   */
  setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.25, Math.min(4.0, rate)); // Clamp to reasonable range
    
    // If currently playing, update the source node and adjust timing
    if (this.sourceNode && this.isPlaying && this.audioContext) {
      // Calculate current audio position before rate change
      const currentPosition = this.getCurrentTime();
      
      // Update the source node playback rate
      this.sourceNode.playbackRate.value = this.playbackRate;
      
      // Recalculate startTime to maintain correct position tracking
      // startTime represents when (in audioContext time) we started from position 0
      // We need to adjust it so getCurrentTime() returns the correct position
      this.startTime = this.audioContext.currentTime - (currentPosition / this.playbackRate);
    }
  }

  /**
   * Get current playback rate
   */
  getPlaybackRate(): number {
    return this.playbackRate;
  }

  /**
   * Subscribe to time updates (called on each animation frame during playback)
   */
  subscribe(callback: (time: number) => void): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Start time update loop
   */
  private startTimeUpdates(): void {
    if (this.animationFrameId !== null) return; // Already running
    
    const updateLoop = () => {
      if (!this.isPlaying) {
        this.animationFrameId = null;
        return;
      }
      
      const currentTime = this.getCurrentTime();
      
      // Notify all subscribers
      this.subscribers.forEach(callback => {
        try {
          callback(currentTime);
        } catch (error) {
          console.error('Error in playback subscriber:', error);
        }
      });
      
      // Check if playback has ended (current position >= buffer duration)
      if (this.buffer && currentTime >= this.buffer.duration) {
        this.stop();
        return;
      }
      
      this.animationFrameId = requestAnimationFrame(updateLoop);
    };
    
    this.animationFrameId = requestAnimationFrame(updateLoop);
  }

  /**
   * Stop time update loop
   */
  private stopTimeUpdates(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stop();
    this.stopTimeUpdates();
    this.subscribers.clear();
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
