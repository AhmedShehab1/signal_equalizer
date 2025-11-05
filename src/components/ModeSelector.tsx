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
    <div className="mode-selector">
      <h3>Equalizer Modes</h3>
      <div className="mode-buttons">
        {modes.map(mode => (
          <button
            key={mode.name}
            onClick={() => onModeSelect(mode.name)}
            className={currentMode === mode.name ? 'active' : ''}
            style={{
              backgroundColor: currentMode === mode.name ? '#646cff' : '#1a1a1a',
            }}
          >
            {mode.name}
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
