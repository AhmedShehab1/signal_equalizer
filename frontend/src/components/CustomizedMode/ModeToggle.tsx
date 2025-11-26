/**
 * ModeToggle Component
 * 
 * Toggle control for switching between Advanced (DSP) and Expert (AI) processing modes.
 * Presentational component with no internal state - fully controlled by parent.
 * 
 * @example
 * ```tsx
 * <ModeToggle
 *   processingMode="dsp"
 *   onChange={(mode) => setMode(mode)}
 *   disabled={false}
 * />
 * ```
 */

import type { ModeToggleProps } from './types';
import './CustomizedMode.css';

export function ModeToggle({ 
  processingMode, 
  onChange, 
  disabled = false 
}: ModeToggleProps) {
  return (
    <div className="mode-toggle-container">
      <label className="toggle-label">Processing Mode:</label>
      <div className="toggle-buttons">
        <button
          className={`toggle-button ${processingMode === 'dsp' ? 'active' : ''}`}
          onClick={() => onChange('dsp')}
          disabled={disabled}
          aria-pressed={processingMode === 'dsp'}
          aria-label="Switch to Advanced DSP mode"
        >
          🏛️ Advanced
        </button>
        <button
          className={`toggle-button ${processingMode === 'ai' ? 'active' : ''}`}
          onClick={() => onChange('ai')}
          disabled={disabled}
          aria-pressed={processingMode === 'ai'}
          aria-label="Switch to Expert AI mode"
        >
          🧠 Expert
        </button>
      </div>
    </div>
  );
}
