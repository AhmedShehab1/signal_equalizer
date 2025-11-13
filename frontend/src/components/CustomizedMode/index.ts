/**
 * CustomizedMode Component Exports
 * 
 * Central export point for all CustomizedMode subcomponents, hooks, and types.
 * Simplifies imports throughout the application.
 * 
 * @example
 * ```tsx
 * import { ModeToggle, ContentTypeSelector, useAudioMixing } from './components/CustomizedMode';
 * ```
 */

// Main orchestrator (to be refactored)
export { default as CustomizedModePanel } from '../CustomizedModePanel';

// Presentational Components
export { ModeToggle } from './ModeToggle';
export { ContentTypeSelector } from './ContentTypeSelector';
export { DSPControls } from './DSPControls';
export { AIControls } from './AIControls';
export { SourceCard } from './SourceCard';
export { SourceList } from './SourceList';

// Custom Hooks
export { useAudioMixing } from './hooks/useAudioMixing';
export { useAudioPlayback } from './hooks/useAudioPlayback';

// Types
export type {
  ProcessingMode,
  ContentType,
  ModelType,
  AISeparationCache,
  CustomizedModePanelProps,
  ModeToggleProps,
  ContentTypeSelectorProps,
  AIControlsProps,
  SourceCardProps,
  SourceListProps,
  UseAudioMixingReturn,
  UseAudioPlaybackReturn,
  AudioSourceMetadata
} from './types';
