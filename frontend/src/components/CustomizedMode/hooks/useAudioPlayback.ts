/**
 * useAudioPlayback Hook
 * 
 * Model-agnostic audio playback engine for separated sources.
 * Manages AudioContext lifecycle, source node creation, and playback state.
 * 
 * @example
 * ```tsx
 * const { playingSource, togglePlayback, stopPlayback, cleanup } = useAudioPlayback();
 * 
 * // Play a source
 * togglePlayback('drums', drumBuffer);
 * 
 * // Stop playback
 * stopPlayback();
 * 
 * // Cleanup on unmount
 * useEffect(() => cleanup, [cleanup]);
 * ```
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { UseAudioPlaybackReturn } from '../types';

/**
 * Audio playback hook
 * Handles play/stop for individual sources with proper cleanup
 */
export function useAudioPlayback(): UseAudioPlaybackReturn {
  // Current playing source ID
  const [playingSource, setPlayingSource] = useState<string | null>(null);
  
  // Audio context and source node refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  
  /**
   * Get or create AudioContext
   */
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);
  
  /**
   * Stop current playback and clean up source node
   */
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch (error) {
        // Ignore errors if already stopped
        console.debug('[useAudioPlayback] Stop error (likely already stopped):', error);
      }
      sourceNodeRef.current = null;
    }
    setPlayingSource(null);
  }, []);
  
  /**
   * Toggle playback for a source
   * If same source is playing, stop it. Otherwise, play the new source.
   */
  const togglePlayback = useCallback((sourceId: string, buffer: AudioBuffer) => {
    // If same source is playing, stop it
    if (playingSource === sourceId) {
      stopPlayback();
      return;
    }
    
    // Stop any current playback
    stopPlayback();
    
    try {
      const audioContext = getAudioContext();
      
      // Resume context if suspended (required by some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      // Create and configure source node
      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = buffer;
      sourceNode.connect(audioContext.destination);
      
      // Handle playback end
      sourceNode.onended = () => {
        setPlayingSource(null);
        sourceNodeRef.current = null;
      };
      
      // Start playback
      sourceNode.start(0);
      sourceNodeRef.current = sourceNode;
      setPlayingSource(sourceId);
      
      console.debug(`[useAudioPlayback] Playing source: ${sourceId}`);
    } catch (error) {
      console.error('[useAudioPlayback] Playback failed:', error);
      setPlayingSource(null);
      sourceNodeRef.current = null;
    }
  }, [playingSource, stopPlayback, getAudioContext]);
  
  /**
   * Cleanup audio resources
   * Should be called on component unmount
   */
  const cleanup = useCallback(() => {
    stopPlayback();
    
    if (audioContextRef.current) {
      // Close context to free resources
      audioContextRef.current.close().catch(err => {
        console.debug('[useAudioPlayback] Context close error:', err);
      });
      audioContextRef.current = null;
    }
  }, [stopPlayback]);
  
  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);
  
  return {
    playingSource,
    togglePlayback,
    stopPlayback,
    cleanup
  };
}
