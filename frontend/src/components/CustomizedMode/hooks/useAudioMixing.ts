/**
 * useAudioMixing Hook
 * 
 * Unified audio mixing hook with model-specific delegates.
 * Manages source gains, mute/solo states, and audio buffer mixing
 * for both speech (DPRNN) and music (Demucs) separation models.
 * 
 * @example
 * ```tsx
 * const {
 *   sourceGains,
 *   mutedSources,
 *   soloedSources,
 *   setGain,
 *   toggleMute,
 *   toggleSolo,
 *   mixAudio,
 *   resetGains
 * } = useAudioMixing({
 *   modelType: 'demucs',
 *   sourceBuffers: { drums: buffer1, bass: buffer2 },
 *   initialGains: { drums: 1.0, bass: 0.8 }
 * });
 * ```
 */

import { useState, useCallback, useMemo } from 'react';
import { mixSources } from '../../../lib/audioMixer';
import type { ModelType, UseAudioMixingReturn } from '../types';

interface UseAudioMixingParams {
  /** Model type determines mixing behavior */
  modelType: ModelType;
  
  /** Source audio buffers */
  sourceBuffers: Record<string, AudioBuffer>;
  
  /** Initial gain values (defaults to 1.0 for each source) */
  initialGains?: Record<string, number>;
  
  /** AudioContext for buffer creation (optional, will create if needed) */
  audioContext?: AudioContext;
}

/**
 * Unified audio mixing hook
 * Routes to model-specific mixing logic internally while exposing consistent API
 */
export function useAudioMixing({
  modelType,
  sourceBuffers,
  initialGains = {},
  audioContext: providedContext
}: UseAudioMixingParams): UseAudioMixingReturn {
  
  // Get or create AudioContext
  const audioContext = useMemo(() => {
    return providedContext || new AudioContext();
  }, [providedContext]);
  
  // Source IDs derived from buffers
  const sourceIds = useMemo(() => Object.keys(sourceBuffers), [sourceBuffers]);
  
  // Initialize gains with defaults
  const [sourceGains, setSourceGains] = useState<Record<string, number>>(() => {
    const gains: Record<string, number> = {};
    for (const id of sourceIds) {
      gains[id] = initialGains[id] ?? 1.0;
    }
    return gains;
  });
  
  // Mute/Solo state
  const [mutedSources, setMutedSources] = useState<Set<string>>(new Set());
  const [soloedSources, setSoloedSources] = useState<Set<string>>(new Set());
  
  /**
   * Set gain for a specific source
   */
  const setGain = useCallback((sourceId: string, gain: number) => {
    setSourceGains(prev => ({
      ...prev,
      [sourceId]: Math.max(0, Math.min(2.0, gain)) // Clamp 0-2
    }));
  }, []);
  
  /**
   * Toggle mute for a source
   */
  const toggleMute = useCallback((sourceId: string) => {
    setMutedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);
  
  /**
   * Toggle solo for a source
   * In solo mode, only soloed sources are audible
   */
  const toggleSolo = useCallback((sourceId: string) => {
    setSoloedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);
  
  /**
   * Calculate effective gains based on mute/solo state
   */
  const effectiveGains = useMemo(() => {
    const gains: Record<string, number> = {};
    
    // If any source is soloed, only play soloed sources
    const hasSolo = soloedSources.size > 0;
    
    for (const id of sourceIds) {
      const baseGain = sourceGains[id] ?? 1.0;
      const isMuted = mutedSources.has(id);
      const isSoloed = soloedSources.has(id);
      
      if (isMuted) {
        gains[id] = 0; // Muted sources are silent
      } else if (hasSolo) {
        gains[id] = isSoloed ? baseGain : 0; // Only soloed sources audible
      } else {
        gains[id] = baseGain; // Normal playback
      }
    }
    
    return gains;
  }, [sourceIds, sourceGains, mutedSources, soloedSources]);
  
  /**
   * Mix all sources into single AudioBuffer
   * Routes to model-specific mixer internally
   */
  const mixAudio = useCallback((): AudioBuffer | null => {
    if (sourceIds.length === 0) {
      console.warn('[useAudioMixing] No sources to mix');
      return null;
    }
    
    try {
      // Model-specific mixing logic
      if (modelType === 'dprnn') {
        return mixSpeechSources(sourceBuffers, effectiveGains, audioContext);
      } else if (modelType === 'demucs') {
        return mixMusicSources(sourceBuffers, effectiveGains, audioContext);
      } else {
        // Fallback: generic mixing
        return mixSources(sourceBuffers, effectiveGains, audioContext);
      }
    } catch (error) {
      console.error('[useAudioMixing] Mix failed:', error);
      return null;
    }
  }, [modelType, sourceBuffers, effectiveGains, audioContext, sourceIds.length]);
  
  /**
   * Reset all gains to 1.0
   */
  const resetGains = useCallback(() => {
    const resetValues: Record<string, number> = {};
    for (const id of sourceIds) {
      resetValues[id] = 1.0;
    }
    setSourceGains(resetValues);
    setMutedSources(new Set());
    setSoloedSources(new Set());
  }, [sourceIds]);
  
  /**
   * Clear all state
   */
  const clear = useCallback(() => {
    setSourceGains({});
    setMutedSources(new Set());
    setSoloedSources(new Set());
  }, []);
  
  return {
    sourceGains,
    mutedSources,
    soloedSources,
    setGain,
    toggleMute,
    toggleSolo,
    mixAudio,
    resetGains,
    clear
  };
}

/**
 * Speech-specific mixing (DPRNN)
 * Handles variable number of mono sources
 */
function mixSpeechSources(
  buffers: Record<string, AudioBuffer>,
  gains: Record<string, number>,
  audioContext: AudioContext
): AudioBuffer {
  // DPRNN produces mono sources - use standard mixer
  return mixSources(buffers, gains, audioContext);
}

/**
 * Music-specific mixing (Demucs)
 * Handles 4 stereo sources (drums, bass, vocals, other)
 */
function mixMusicSources(
  buffers: Record<string, AudioBuffer>,
  gains: Record<string, number>,
  audioContext: AudioContext
): AudioBuffer {
  const bufferKeys = Object.keys(buffers);
  if (bufferKeys.length === 0) {
    throw new Error('No music sources to mix');
  }
  
  // Filter to active sources (gain > 0)
  const activeSources = bufferKeys.filter(key => (gains[key] ?? 1.0) > 0);
  
  if (activeSources.length === 0) {
    console.warn('[mixMusicSources] All sources muted - returning silence');
    const firstBuffer = buffers[bufferKeys[0]];
    const numChannels = firstBuffer.numberOfChannels;
    return audioContext.createBuffer(numChannels, firstBuffer.length, firstBuffer.sampleRate);
  }
  
  // Get dimensions from first buffer
  const firstBuffer = buffers[activeSources[0]];
  const length = firstBuffer.length;
  const sampleRate = firstBuffer.sampleRate;
  const numChannels = firstBuffer.numberOfChannels;
  
  // Create stereo output buffer
  const mixedBuffer = audioContext.createBuffer(numChannels, length, sampleRate);
  
  // Mix each channel independently
  for (let ch = 0; ch < numChannels; ch++) {
    const mixedData = mixedBuffer.getChannelData(ch);
    
    // Sum all active sources
    for (const sourceKey of activeSources) {
      const buffer = buffers[sourceKey];
      const gain = gains[sourceKey] ?? 1.0;
      
      // Handle mono sources in stereo output
      const sourceChannelIndex = Math.min(ch, buffer.numberOfChannels - 1);
      const sourceData = buffer.getChannelData(sourceChannelIndex);
      
      for (let i = 0; i < length; i++) {
        mixedData[i] += sourceData[i] * gain;
      }
    }
    
    // Normalize channel to prevent clipping
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
      maxVal = Math.max(maxVal, Math.abs(mixedData[i]));
    }
    if (maxVal > 1.0) {
      const normFactor = 1.0 / maxVal;
      for (let i = 0; i < length; i++) {
        mixedData[i] *= normFactor;
      }
    }
  }
  
  return mixedBuffer;
}
