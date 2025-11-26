/**
 * SourceList Component
 * 
 * Container component that renders a list of SourceCard components.
 * Handles empty states, loading states, and coordinates source controls.
 * Works with both speech (variable sources) and music (4 fixed sources).
 * 
 * @example
 * ```tsx
 * <SourceList
 *   sourceIds={['drums', 'bass', 'vocals', 'other']}
 *   getLabel={(id) => id.toUpperCase()}
 *   sourceGains={{ drums: 1.0, bass: 0.8 }}
 *   playingSource="drums"
 *   soloedSources={new Set(['drums'])}
 *   mutedSources={new Set()}
 *   onPlayToggle={(id) => play(id)}
 *   onSoloToggle={(id) => solo(id)}
 *   onMuteToggle={(id) => mute(id)}
 *   onGainChange={(id, gain) => setGain(id, gain)}
 *   spectrogramUrls={{ drums: '/drums.png' }}
 *   audioShapes={{ drums: '2 × 44100' }}
 * />
 * ```
 */

import { SourceCard } from './SourceCard';
import type { SourceListProps } from './types';
import './CustomizedMode.css';

export function SourceList({
  sourceIds,
  getLabel,
  sourceGains,
  playingSource,
  soloedSources,
  mutedSources,
  onPlayToggle,
  onSoloToggle,
  onMuteToggle,
  onGainChange,
  spectrogramUrls = {},
  audioShapes = {},
  disabled = false
}: SourceListProps) {
  
  // Handle empty state
  if (sourceIds.length === 0) {
    return (
      <div className="source-list-empty">
        <p className="empty-message">
          No sources available. Process audio to see separated sources.
        </p>
      </div>
    );
  }
  
  return (
    <div className="source-list">
      <div className="source-list-header">
        <h3>
          Detected Sources: {sourceIds.length}
          {sourceIds.length === 4 && ' (Drums, Bass, Vocals, Other)'}
        </h3>
        <button
          onClick={() => onPlayToggle(playingSource || '')}
          disabled={!playingSource || disabled}
          className="stop-all-button"
          aria-label="Stop all playback"
        >
          ⏹ Stop Playback
        </button>
      </div>
      
      <div className="sources-container">
        {sourceIds.map((sourceId) => {
          const gain = sourceGains[sourceId] ?? 1.0;
          const isMuted = mutedSources.has(sourceId);
          const isSoloed = soloedSources.has(sourceId);
          const isPlaying = playingSource === sourceId;
          const label = getLabel(sourceId);
          const spectrogramUrl = spectrogramUrls[sourceId];
          const audioShape = audioShapes[sourceId];
          
          return (
            <SourceCard
              key={sourceId}
              sourceId={sourceId}
              label={label}
              gain={gain}
              isMuted={isMuted}
              isSoloed={isSoloed}
              isPlaying={isPlaying}
              onPlayToggle={onPlayToggle}
              onSoloToggle={onSoloToggle}
              onMuteToggle={onMuteToggle}
              onGainChange={onGainChange}
              spectrogramUrl={spectrogramUrl}
              audioShape={audioShape}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
}
