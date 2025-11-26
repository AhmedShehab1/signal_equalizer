/**
 * Shared types for CustomizedMode components
 * 
 * This module provides type definitions used across all CustomizedMode subcomponents,
 * ensuring type safety and consistency throughout the refactored architecture.
 */

import type { SpeechSeparationResult, SeparationResult } from '../../lib/api';
import type { BandSpec } from '../../model/types';

/**
 * Processing mode selection: DSP (band EQ) or AI (source separation)
 */
export type ProcessingMode = 'dsp' | 'ai';

/**
 * Content type determines which AI model to use
 * - 'music': Uses Hybrid Demucs (4 sources: drums, bass, vocals, other)
 * - 'speech': Uses MultiDecoderDPRNN (variable sources)
 */
export type ContentType = 'music' | 'speech';

/**
 * AI model identifier
 * - 'demucs': Hybrid Demucs for music separation
 * - 'dprnn': MultiDecoderDPRNN for speech separation
 */
export type ModelType = 'demucs' | 'dprnn';

/**
 * Cache structure for AI separation results
 * Persists across tab switches to avoid re-processing
 */
export interface AISeparationCache {
  /** DPRNN speech separation results (mono sources) */
  speechResult: SpeechSeparationResult | null;
  
  /** Demucs music separation results (stereo sources) */
  musicResult: SeparationResult | null;
  
  /** Per-source gain values (0.0 to 2.0) */
  sourceGains: Record<string, number>;
  
  /** Decoded AudioBuffer for each source */
  sourceBuffers: Record<string, AudioBuffer>;
  
  /** Cache timestamp for invalidation */
  timestamp: number;
  
  /** Original audio filename */
  fileName: string;
  
  /** Content type when cache was created */
  contentType: ContentType;
  
  /** Model type used for separation */
  modelType: ModelType;
}

/**
 * Props for CustomizedModePanel (main orchestrator)
 */
export interface CustomizedModePanelProps {
  /** Callback when DSP band specs change */
  onBandSpecsChange: (bandSpecs: BandSpec[]) => void;
  
  /** Disable all controls */
  disabled?: boolean;
  
  /** Audio file for AI processing */
  audioFile?: File | null;
  
  /** Callback when AI sources are mixed */
  onAudioMixed?: (mixedBuffer: AudioBuffer) => void | Promise<void>;
  
  /** Cached AI separation results */
  aiCache?: AISeparationCache | null;
  
  /** Callback when AI cache updates */
  onAICacheUpdate?: (
    result: SpeechSeparationResult | SeparationResult | null,
    sourceGains: Record<string, number>,
    sourceBuffers: Record<string, AudioBuffer>,
    contentType: ContentType,
    modelType: ModelType
  ) => void;
  
  /** Active tab (controlled) */
  activeTab?: ProcessingMode;
  
  /** Callback when tab changes */
  onTabChange?: (tab: ProcessingMode) => void;
}

/**
 * Props for ModeToggle component
 */
export interface ModeToggleProps {
  /** Current processing mode */
  processingMode: ProcessingMode;
  
  /** Callback when mode changes */
  onChange: (mode: ProcessingMode) => void;
  
  /** Disable toggle */
  disabled?: boolean;
}

/**
 * Props for ContentTypeSelector component
 */
export interface ContentTypeSelectorProps {
  /** Current content type */
  contentType: ContentType;
  
  /** Callback when content type changes */
  onChange: (type: ContentType) => void;
  
  /** Disable selector */
  disabled?: boolean;
}

/**
 * Props for AIControls component
 */
export interface AIControlsProps {
  /** Current content type (determines demo sample) */
  contentType: ContentType;
  
  /** Audio file for processing */
  audioFile: File | null;
  
  /** Callback when process is triggered */
  onProcess: () => void;
  
  /** Callback when demo is triggered */
  onDemo: () => void;
  
  /** Processing in progress */
  processing: boolean;
  
  /** Disable controls */
  disabled?: boolean;
}

/**
 * Props for individual SourceCard component
 */
export interface SourceCardProps {
  /** Source identifier (e.g., 'drums', 'source_0') */
  sourceId: string;
  
  /** Display label for source */
  label: string;
  
  /** Current gain value (0.0 to 2.0) */
  gain: number;
  
  /** Source is muted */
  isMuted: boolean;
  
  /** Source is soloed */
  isSoloed: boolean;
  
  /** Currently playing */
  isPlaying: boolean;
  
  /** Callback when play is toggled */
  onPlayToggle: (sourceId: string) => void;
  
  /** Callback when solo is toggled */
  onSoloToggle: (sourceId: string) => void;
  
  /** Callback when mute is toggled */
  onMuteToggle: (sourceId: string) => void;
  
  /** Callback when gain changes */
  onGainChange: (sourceId: string, gain: number) => void;
  
  /** Optional spectrogram URL */
  spectrogramUrl?: string;
  
  /** Optional audio shape info */
  audioShape?: string;
  
  /** Disable all controls */
  disabled?: boolean;
}

/**
 * Props for SourceList component
 */
export interface SourceListProps {
  /** Array of source IDs */
  sourceIds: string[];
  
  /** Get label for source ID */
  getLabel: (id: string) => string;
  
  /** Source gains */
  sourceGains: Record<string, number>;
  
  /** Currently playing source */
  playingSource: string | null;
  
  /** Soloed sources */
  soloedSources: Set<string>;
  
  /** Muted sources */
  mutedSources: Set<string>;
  
  /** Callback when play is toggled */
  onPlayToggle: (sourceId: string) => void;
  
  /** Callback when solo is toggled */
  onSoloToggle: (sourceId: string) => void;
  
  /** Callback when mute is toggled */
  onMuteToggle: (sourceId: string) => void;
  
  /** Callback when gain changes */
  onGainChange: (sourceId: string, gain: number) => void;
  
  /** Optional spectrogram URLs */
  spectrogramUrls?: Record<string, string>;
  
  /** Optional audio shapes */
  audioShapes?: Record<string, string>;
  
  /** Disable all controls */
  disabled?: boolean;
}

/**
 * Return type for useAudioMixing hook
 */
export interface UseAudioMixingReturn {
  /** Per-source gain values */
  sourceGains: Record<string, number>;
  
  /** Muted source IDs */
  mutedSources: Set<string>;
  
  /** Soloed source IDs */
  soloedSources: Set<string>;
  
  /** Update gain for a source */
  setGain: (sourceId: string, gain: number) => void;
  
  /** Toggle mute for a source */
  toggleMute: (sourceId: string) => void;
  
  /** Toggle solo for a source */
  toggleSolo: (sourceId: string) => void;
  
  /** Mix all sources into single buffer */
  mixAudio: () => AudioBuffer | null;
  
  /** Reset all gains to 1.0 */
  resetGains: () => void;
  
  /** Clear all state */
  clear: () => void;
}

/**
 * Return type for useAudioPlayback hook
 */
export interface UseAudioPlaybackReturn {
  /** Currently playing source ID */
  playingSource: string | null;
  
  /** Play or stop a source */
  togglePlayback: (sourceId: string, buffer: AudioBuffer) => void;
  
  /** Stop all playback */
  stopPlayback: () => void;
  
  /** Cleanup audio resources */
  cleanup: () => void;
}

/**
 * Audio source metadata
 */
export interface AudioSourceMetadata {
  /** Source identifier */
  id: string;
  
  /** Display label */
  label: string;
  
  /** Audio buffer */
  buffer: AudioBuffer;
  
  /** Optional spectrogram URL */
  spectrogramUrl?: string;
  
  /** Audio shape (e.g., "2 x 44100") */
  audioShape?: string;
}
