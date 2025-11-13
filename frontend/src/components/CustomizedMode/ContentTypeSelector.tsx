/**
 * ContentTypeSelector Component
 * 
 * Selector for choosing between Music and Speech content types.
 * Determines which AI model to use (Demucs vs DPRNN).
 * Includes educational tooltips and contextual help text.
 * 
 * @example
 * ```tsx
 * <ContentTypeSelector
 *   contentType="music"
 *   onChange={(type) => setContentType(type)}
 *   disabled={false}
 * />
 * ```
 */

import type { ContentTypeSelectorProps } from './types';

export function ContentTypeSelector({ 
  contentType, 
  onChange, 
  disabled = false 
}: ContentTypeSelectorProps) {
  
  // Helper text based on selected content type
  const getHelpText = () => {
    if (contentType === 'speech') {
      return '💡 Best for: podcasts, interviews, voice recordings. Uses DPRNN model.';
    } else {
      return '💡 Best for: songs, instrumentals. Separates into drums, bass, vocals, other. Uses Hybrid Demucs.';
    }
  };
  
  return (
    <div className="content-type-selector">
      <label className="toggle-label">Content Type:</label>
      <div className="toggle-buttons">
        <button
          className={`toggle-button ${contentType === 'speech' ? 'active' : ''}`}
          onClick={() => onChange('speech')}
          disabled={disabled}
          title="Separate speech/vocals from background noise and music"
          aria-pressed={contentType === 'speech'}
          aria-label="Select Speech/Vocals content type"
        >
          🎤 Speech/Vocals
        </button>
        <button
          className={`toggle-button ${contentType === 'music' ? 'active' : ''}`}
          onClick={() => onChange('music')}
          disabled={disabled}
          title="Separate music into drums, bass, vocals, and other instruments"
          aria-pressed={contentType === 'music'}
          aria-label="Select Music content type"
        >
          🎵 Music
        </button>
      </div>
      <p className="content-type-hint">
        {getHelpText()}
      </p>
    </div>
  );
}
