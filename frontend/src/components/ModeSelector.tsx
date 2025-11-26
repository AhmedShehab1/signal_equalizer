/**
 * Component for selecting equalizer modes
 */

import { EqualizerMode } from '../model/types';

interface ModeSelectorProps {
  modes: EqualizerMode[];
  currentMode: string | null;
  onModeSelect: (modeName: string) => void;
}

export default function ModeSelector({ modes, currentMode, onModeSelect }: ModeSelectorProps) {
  return (
    <div className="mode-selector glass-panel">
      <h3>🎛️ Equalizer Modes</h3>
      <div className="mode-buttons">
        {modes.map(mode => (
          <button
            key={mode.name}
            onClick={() => onModeSelect(mode.name)}
            className={`btn ${currentMode === mode.name ? 'btn-accent' : 'btn-ghost'}`}
          >
            {mode.name}
            {currentMode === mode.name && <span className="badge badge-success" style={{marginLeft: '8px'}}>Active</span>}
          </button>
        ))}
      </div>
      {currentMode && (
        <p>
          {modes.find(m => m.name === currentMode)?.description}
        </p>
      )}
    </div>
  );
}
