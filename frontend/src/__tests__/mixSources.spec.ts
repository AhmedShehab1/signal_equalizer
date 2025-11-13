/**
 * Unit tests for mixSources audio mixing logic
 * Tests mute/solo behavior and gain application
 * 
 * IMPORTANT: These tests use the ACTUAL production code from audioMixer.ts
 * to ensure test-production parity and catch regressions immediately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mixSources } from '../lib/audioMixer';

// Mock AudioContext and AudioBuffer for testing
class MockAudioContext {
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer(channels, length, sampleRate);
  }
}

class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  private channels: Float32Array[];

  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.channels = Array.from({ length: channels }, () => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel];
  }

  copyFromChannel(_destination: Float32Array, _channelNumber: number, _bufferOffset?: number): void {
    throw new Error('copyFromChannel not implemented in mock');
  }

  copyToChannel(_source: Float32Array, _channelNumber: number, _bufferOffset?: number): void {
    throw new Error('copyToChannel not implemented in mock');
  }
}

// Helper wrapper to call production mixSources with type casting for mocks
function callMixSources(
  buffers: Record<string, MockAudioBuffer>,
  gains: Record<string, number>,
  audioContext: MockAudioContext
): MockAudioBuffer {
  return mixSources(
    buffers as unknown as Record<string, AudioBuffer>,
    gains,
    audioContext as unknown as AudioContext
  ) as unknown as MockAudioBuffer;
}

// Helper to create test audio buffer with sine wave
function createTestBuffer(
  audioContext: MockAudioContext,
  length: number,
  frequency: number,
  amplitude: number = 1.0
): MockAudioBuffer {
  const buffer = audioContext.createBuffer(1, length, 44100);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < length; i++) {
    data[i] = amplitude * Math.sin(2 * Math.PI * frequency * i / 44100);
  }
  
  return buffer;
}

describe('mixSources - Mute/Solo Audio Mixing', () => {
  let audioContext: MockAudioContext;
  const sampleLength = 1000;

  beforeEach(() => {
    audioContext = new MockAudioContext();
  });

  describe('Basic Mixing', () => {
    it('should mix two sources with equal gains', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 0.5),
        source2: createTestBuffer(audioContext, sampleLength, 880, 0.5)
      };
      const gains = { source1: 1.0, source2: 1.0 };

      const mixed = mixSources(
        buffers as Record<string, AudioBuffer>,
        gains,
        audioContext as unknown as AudioContext
      );
      const data = mixed.getChannelData(0);

      // Verify output exists and has data
      expect(data.length).toBe(sampleLength);
      expect(data.some(v => v !== 0)).toBe(true);
    });

    it('should apply gain amplification correctly', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 0.3)
      };
      const gains = { source1: 2.0 };

      const mixed = mixSources(
        buffers as Record<string, AudioBuffer>,
        gains,
        audioContext as unknown as AudioContext
      );
      const data = mixed.getChannelData(0);

      // With gain 2.0, peak should approach 0.6 (0.3 * 2.0)
      const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
      expect(maxAmplitude).toBeGreaterThan(0.5);
      expect(maxAmplitude).toBeLessThanOrEqual(1.0); // Should be normalized
    });
  });

  describe('Mute Behavior (Gain = 0)', () => {
    it('should exclude muted sources from mix (gain = 0)', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 1.0),
        source2: createTestBuffer(audioContext, sampleLength, 880, 1.0)
      };
      const gains = { source1: 1.0, source2: 0 }; // source2 muted

      const mixed = callMixSources(buffers, gains, audioContext);
      const mixedData = mixed.getChannelData(0);
      const source1Data = buffers.source1.getChannelData(0);

      // Mixed output should match source1 only
      for (let i = 0; i < 100; i++) { // Check first 100 samples
        expect(Math.abs(mixedData[i] - source1Data[i])).toBeLessThan(0.001);
      }
    });

    it('should return silence when all sources are muted', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 1.0),
        source2: createTestBuffer(audioContext, sampleLength, 880, 1.0)
      };
      const gains = { source1: 0, source2: 0 }; // All muted

      const mixed = callMixSources(buffers, gains, audioContext);
      const data = mixed.getChannelData(0);

      // All samples should be zero (silence)
      expect(data.every(v => v === 0)).toBe(true);
    });

    it('should handle muting middle source in 3-source mix', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 0.3),
        source2: createTestBuffer(audioContext, sampleLength, 880, 0.3),
        source3: createTestBuffer(audioContext, sampleLength, 1320, 0.3)
      };
      const gains = { source1: 1.0, source2: 0, source3: 1.0 }; // Middle muted

      const mixed = callMixSources(buffers, gains, audioContext);
      const data = mixed.getChannelData(0);

      // Output should exist and contain mixed source1 + source3
      expect(data.some(v => v !== 0)).toBe(true);
      
      // Manually mix source1 + source3 for comparison
      const expected = new Float32Array(sampleLength);
      const s1 = buffers.source1.getChannelData(0);
      const s3 = buffers.source3.getChannelData(0);
      for (let i = 0; i < sampleLength; i++) {
        expected[i] = s1[i] + s3[i];
      }

      // Compare (allowing for normalization differences)
      const actualPeak = Math.max(...Array.from(data).map(Math.abs));
      const expectedPeak = Math.max(...Array.from(expected).map(Math.abs));
      expect(actualPeak).toBeGreaterThan(0);
      expect(Math.abs(actualPeak - expectedPeak)).toBeLessThan(0.1);
    });
  });

  describe('Solo Behavior (One Source at 1.0, Others at 0)', () => {
    it('should output only soloed source', () => {
      const buffers = {
        speech: createTestBuffer(audioContext, sampleLength, 440, 1.0),
        music: createTestBuffer(audioContext, sampleLength, 880, 1.0),
        noise: createTestBuffer(audioContext, sampleLength, 220, 1.0)
      };
      const gains = { speech: 1.0, music: 0, noise: 0 }; // Solo speech

      const mixed = callMixSources(buffers, gains, audioContext);
      const mixedData = mixed.getChannelData(0);
      const speechData = buffers.speech.getChannelData(0);

      // Mixed output should exactly match soloed source
      for (let i = 0; i < 100; i++) {
        expect(Math.abs(mixedData[i] - speechData[i])).toBeLessThan(0.001);
      }
    });

    it('should handle solo with gain adjustment', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 0.5),
        source2: createTestBuffer(audioContext, sampleLength, 880, 0.5)
      };
      const gains = { source1: 1.5, source2: 0 }; // Solo source1 with gain boost

      const mixed = callMixSources(buffers, gains, audioContext);
      const mixedData = mixed.getChannelData(0);
      const source1Data = buffers.source1.getChannelData(0);

      // Mixed should be source1 * 1.5
      for (let i = 0; i < 100; i++) {
        const expected = source1Data[i] * 1.5;
        expect(Math.abs(mixedData[i] - expected)).toBeLessThan(0.01);
      }
    });
  });

  describe('Gain Variations', () => {
    it('should handle gains greater than 1.0', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 0.2)
      };
      const gains = { source1: 3.0 };

      const mixed = callMixSources(buffers, gains, audioContext);
      const data = mixed.getChannelData(0);

      // Should amplify and normalize if needed
      const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
      expect(maxAmplitude).toBeGreaterThan(0.4);
      expect(maxAmplitude).toBeLessThanOrEqual(1.0); // Must not clip
    });

    it('should handle very small gains', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 1.0)
      };
      const gains = { source1: 0.01 };

      const mixed = callMixSources(buffers, gains, audioContext);
      const data = mixed.getChannelData(0);

      // Should produce very quiet output
      const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
      expect(maxAmplitude).toBeLessThan(0.1);
      expect(maxAmplitude).toBeGreaterThan(0);
    });

    it('should handle mix of high and low gains', () => {
      const buffers = {
        loud: createTestBuffer(audioContext, sampleLength, 440, 0.5),
        quiet: createTestBuffer(audioContext, sampleLength, 880, 0.5)
      };
      const gains = { loud: 2.0, quiet: 0.1 };

      const mixed = callMixSources(buffers, gains, audioContext);
      const data = mixed.getChannelData(0);

      // Loud source should dominate
      expect(data.some(v => Math.abs(v) > 0.5)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should throw error for empty buffers', () => {
      const buffers = {};
      const gains = {};

      expect(() => callMixSources(buffers, gains, audioContext)).toThrow('No source buffers to mix');
    });

    it('should handle missing gain defaults to 1.0', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 0.5)
      };
      const gains = {}; // No gain specified

      const mixed = callMixSources(buffers, gains, audioContext);
      const mixedData = mixed.getChannelData(0);
      const source1Data = buffers.source1.getChannelData(0);

      // Should use default gain of 1.0
      for (let i = 0; i < 100; i++) {
        expect(Math.abs(mixedData[i] - source1Data[i])).toBeLessThan(0.001);
      }
    });

    it('should normalize when multiple sources exceed 1.0', () => {
      const buffers = {
        source1: createTestBuffer(audioContext, sampleLength, 440, 0.8),
        source2: createTestBuffer(audioContext, sampleLength, 880, 0.8)
      };
      const gains = { source1: 1.0, source2: 1.0 };

      const mixed = callMixSources(buffers, gains, audioContext);
      const data = mixed.getChannelData(0);

      // Peak should be normalized to ≤ 1.0
      const maxAmplitude = Math.max(...Array.from(data).map(Math.abs));
      expect(maxAmplitude).toBeLessThanOrEqual(1.0);
    });

    it('should handle single source', () => {
      const buffers = {
        solo: createTestBuffer(audioContext, sampleLength, 440, 0.7)
      };
      const gains = { solo: 1.0 };

      const mixed = callMixSources(buffers, gains, audioContext);
      const mixedData = mixed.getChannelData(0);
      const soloData = buffers.solo.getChannelData(0);

      // Output should match input exactly
      for (let i = 0; i < sampleLength; i++) {
        expect(mixedData[i]).toBe(soloData[i]);
      }
    });
  });

  describe('Real-World Scenarios', () => {
    it('should simulate "mute all except vocals" workflow', () => {
      const buffers = {
        vocals: createTestBuffer(audioContext, sampleLength, 440, 0.6),
        drums: createTestBuffer(audioContext, sampleLength, 220, 0.6),
        bass: createTestBuffer(audioContext, sampleLength, 110, 0.6),
        guitar: createTestBuffer(audioContext, sampleLength, 880, 0.6)
      };
      const gains = { vocals: 1.0, drums: 0, bass: 0, guitar: 0 };

      const mixed = callMixSources(buffers, gains, audioContext);
      const mixedData = mixed.getChannelData(0);
      const vocalsData = buffers.vocals.getChannelData(0);

      // Output should be pure vocals
      for (let i = 0; i < 100; i++) {
        expect(Math.abs(mixedData[i] - vocalsData[i])).toBeLessThan(0.001);
      }
    });

    it('should simulate "adjust vocal gain while others play" workflow', () => {
      const buffers = {
        vocals: createTestBuffer(audioContext, sampleLength, 440, 0.5),
        music: createTestBuffer(audioContext, sampleLength, 220, 0.5)
      };
      const gains = { vocals: 1.5, music: 1.0 };

      const mixed = callMixSources(buffers, gains, audioContext);
      const data = mixed.getChannelData(0);

      // Should produce non-zero mixed output
      expect(data.some(v => v !== 0)).toBe(true);
    });

    it('should handle progressive unmuting', () => {
      const buffers = {
        s1: createTestBuffer(audioContext, sampleLength, 440, 0.3),
        s2: createTestBuffer(audioContext, sampleLength, 880, 0.3),
        s3: createTestBuffer(audioContext, sampleLength, 1320, 0.3)
      };

      // Start: all muted
      let gains = { s1: 0, s2: 0, s3: 0 };
      let mixed = callMixSources(buffers, gains, audioContext);
      expect(mixed.getChannelData(0).every(v => v === 0)).toBe(true);

      // Unmute s1
      gains = { s1: 1.0, s2: 0, s3: 0 };
      mixed = callMixSources(buffers, gains, audioContext);
      expect(mixed.getChannelData(0).some(v => v !== 0)).toBe(true);

      // Unmute s2
      gains = { s1: 1.0, s2: 1.0, s3: 0 };
      mixed = callMixSources(buffers, gains, audioContext);
      const peak2 = Math.max(...Array.from(mixed.getChannelData(0)).map(Math.abs));
      expect(peak2).toBeGreaterThan(0);

      // Unmute all
      gains = { s1: 1.0, s2: 1.0, s3: 1.0 };
      mixed = callMixSources(buffers, gains, audioContext);
      const peak3 = Math.max(...Array.from(mixed.getChannelData(0)).map(Math.abs));
      expect(peak3).toBeGreaterThan(peak2);
    });
  });
});
