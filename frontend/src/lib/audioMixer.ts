/**
 * Audio Mixer Utilities
 * Pure functions for mixing audio sources with gain control
 */

/**
 * Mix multiple audio sources with individual gain controls
 * Only includes sources with gain > 0 for proper mute/solo behavior
 * 
 * @param buffers - Record of source keys to AudioBuffer objects
 * @param gains - Record of source keys to gain values (0-2+)
 * @param audioContext - AudioContext for creating output buffer
 * @returns Mixed AudioBuffer with normalization applied if needed
 * 
 * @throws Error if buffers is empty
 * 
 * @example
 * ```ts
 * const buffers = { vocals: buffer1, music: buffer2 };
 * const gains = { vocals: 1.0, music: 0.0 }; // music muted
 * const mixed = mixSources(buffers, gains, audioContext);
 * ```
 */
export function mixSources(
  buffers: Record<string, AudioBuffer>,
  gains: Record<string, number>,
  audioContext: AudioContext
): AudioBuffer {
  const bufferKeys = Object.keys(buffers);
  if (bufferKeys.length === 0) {
    throw new Error('No source buffers to mix');
  }
  
  // Filter to only unmuted sources (gain > 0)
  const activeSources = bufferKeys.filter(key => (gains[key] ?? 1.0) > 0);
  
  // Validation: Log mute/solo state for debugging
  if (import.meta.env.DEV) {
    console.debug(`[mixSources] Active: ${activeSources.length}/${bufferKeys.length} sources`, {
      active: activeSources.map(k => ({ key: k, gain: gains[k] })),
      muted: bufferKeys.filter(k => (gains[k] ?? 1.0) === 0)
    });
  }
  
  // Handle edge case: all sources muted
  if (activeSources.length === 0) {
    console.warn('[mixSources] All sources muted - returning silence');
    const firstBuffer = buffers[bufferKeys[0]];
    return audioContext.createBuffer(1, firstBuffer.length, firstBuffer.sampleRate);
  }
  
  // Get first active buffer to determine size and sample rate
  const firstBuffer = buffers[activeSources[0]];
  const length = firstBuffer.length;
  const sampleRate = firstBuffer.sampleRate;
  
  // Create output buffer (mono)
  const mixedBuffer = audioContext.createBuffer(1, length, sampleRate);
  const mixedData = mixedBuffer.getChannelData(0);
  
  // Mix only active (unmuted) sources
  for (const sourceKey of activeSources) {
    const buffer = buffers[sourceKey];
    const gain = gains[sourceKey] ?? 1.0;
    const sourceData = buffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
      mixedData[i] += sourceData[i] * gain;
    }
  }
  
  // Normalize to prevent clipping
  let maxVal = 0;
  for (let i = 0; i < length; i++) {
    maxVal = Math.max(maxVal, Math.abs(mixedData[i]));
  }
  if (maxVal > 1.0) {
    const normFactor = 1.0 / maxVal;
    for (let i = 0; i < length; i++) {
      mixedData[i] *= normFactor;
    }
    if (import.meta.env.DEV) {
      console.debug(`[mixSources] Normalized by ${normFactor.toFixed(3)} to prevent clipping`);
    }
  }
  
  return mixedBuffer;
}

/**
 * Calculate effective gains for solo mode
 * When a source is soloed, all others are set to 0
 * 
 * @param sourceKeys - All available source keys
 * @param soloedSource - Key of the soloed source, or null if none
 * @param currentGains - Current gain values (used when no solo active)
 * @returns Effective gain map
 */
export function calculateSoloGains(
  sourceKeys: string[],
  soloedSource: string | null,
  currentGains: Record<string, number>
): Record<string, number> {
  if (!soloedSource) {
    return currentGains;
  }
  
  const soloGains: Record<string, number> = {};
  for (const key of sourceKeys) {
    soloGains[key] = key === soloedSource ? (currentGains[key] ?? 1.0) : 0;
  }
  return soloGains;
}

/**
 * Restore all gains when exiting solo mode
 * 
 * @param sourceKeys - All available source keys
 * @param defaultGain - Default gain to apply to all sources (default: 1.0)
 * @returns Gain map with all sources at default gain
 */
export function restoreAllGains(
  sourceKeys: string[],
  defaultGain: number = 1.0
): Record<string, number> {
  const restoredGains: Record<string, number> = {};
  for (const key of sourceKeys) {
    restoredGains[key] = defaultGain;
  }
  return restoredGains;
}
