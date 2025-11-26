import type { ChangeEvent, ReactNode } from 'react';
import { EqualizerMode } from '../model/types';

type AppMode = 'preset' | 'generic' | 'custom';

interface PresetToolbarProps {
  modes: EqualizerMode[];
  currentMode: string | null;
  onModeSelect: (modeName: string) => void;
  mode: AppMode;
  fileLoaderSlot: ReactNode;
  disabled?: boolean;
  onReset?: () => void;
}

export function PresetToolbar({
  modes,
  currentMode,
  onModeSelect,
  mode,
  fileLoaderSlot,
  disabled = false,
  onReset,
}: PresetToolbarProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value) {
      onModeSelect(value);
    }
  };

  return (
    <div className="preset-toolbar">
      <div className="preset-toolbar__group">
        <span className="preset-toolbar__label">Preset:</span>
        {mode === 'preset' ? (
          <div className="preset-toolbar__select-wrapper">
            <select
              className="preset-toolbar__select"
              value={currentMode ?? ''}
              onChange={handleChange}
              disabled={disabled || modes.length === 0}
            >
              <option value="" disabled hidden>
                {modes.length === 0 ? 'Loading presets…' : 'Choose preset'}
              </option>
              {modes.map(modeOption => (
                <option key={modeOption.name} value={modeOption.name}>
                  {modeOption.name}
                </option>
              ))}
            </select>
            <span className="preset-toolbar__chevron">⌄</span>
          </div>
        ) : (
          <span className="preset-toolbar__hint">Presets available in Basic mode</span>
        )}
      </div>
      <div className="preset-toolbar__actions">
        {mode === 'preset' && (
          <button
            className="eq-icon-btn"
            type="button"
            onClick={() => onReset?.()}
            disabled={disabled || !onReset}
            aria-label="Reset bands"
          >
            ↺
          </button>
        )}
        <button className="eq-icon-btn" type="button" disabled>
          +
        </button>
        <div className="preset-toolbar__loader" aria-live="polite">
          {fileLoaderSlot}
        </div>
      </div>
    </div>
  );
}
