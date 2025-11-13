/**
 * AIControls Component
 * 
 * Control panel for AI source separation processing.
 * Provides "Separate Sources" and "Try Demo" buttons with contextual messaging.
 * Handles loading states, file validation, and user guidance.
 * 
 * @example
 * ```tsx
 * <AIControls
 *   contentType="music"
 *   audioFile={file}
 *   onProcess={() => handleSeparation()}
 *   onDemo={() => handleDemo()}
 *   processing={false}
 *   disabled={false}
 * />
 * ```
 */

import type { AIControlsProps } from './types';

interface AIControlsExtendedProps extends AIControlsProps {
  /** Whether results already exist (changes button text) */
  hasResults?: boolean;
  
  /** Cache information for display */
  cacheInfo?: {
    timestamp: number;
    contentType: 'music' | 'speech';
  } | null;
}

export function AIControls({ 
  contentType,
  audioFile,
  onProcess,
  onDemo,
  processing,
  disabled = false,
  hasResults = false,
  cacheInfo = null
}: AIControlsExtendedProps) {
  
  // Button text based on state
  const getProcessButtonText = () => {
    if (processing) return 'Processing...';
    if (hasResults) return 'Re-separate Sources';
    return 'Separate Sources';
  };
  
  const getDemoButtonText = () => {
    if (processing) return 'Processing...';
    return `Try ${contentType === 'speech' ? 'Speech' : 'Music'} Demo`;
  };
  
  // Show cache restoration message
  const showCacheMessage = cacheInfo && 
    !hasResults && 
    cacheInfo.contentType === contentType;
  
  return (
    <div className="ai-controls-container">
      <div className="ai-info-section">
        <p className="ai-description">
          {contentType === 'speech' 
            ? 'AI-powered speech separation using MultiDecoderDPRNN. Separates speech from background noise and music. Processing typically takes 30-60 seconds.'
            : 'AI-powered music separation using Hybrid Demucs. Separates audio into drums, bass, vocals, and other instruments. Processing typically takes 60-90 seconds.'}
        </p>
      </div>

      <div className="ai-actions">
        <button
          onClick={onProcess}
          disabled={!audioFile || processing || disabled}
          className="process-button"
          aria-label={getProcessButtonText()}
        >
          {getProcessButtonText()}
        </button>
        
        <button
          onClick={onDemo}
          disabled={processing || disabled}
          className="demo-button"
          aria-label={getDemoButtonText()}
        >
          {getDemoButtonText()}
        </button>
      </div>
      
      {/* User guidance messages */}
      <div className="ai-messages">
        {!audioFile && (
          <p className="info-message">
            💡 Upload an audio file or try the demo to get started
          </p>
        )}
        
        {showCacheMessage && (
          <p className="cache-info">
            ℹ️ Previous results available from {new Date(cacheInfo.timestamp).toLocaleTimeString()}
            {' - '}restored automatically
          </p>
        )}
        
        {hasResults && cacheInfo && (
          <p className="cache-timestamp">
            Last processed: {new Date(cacheInfo.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
