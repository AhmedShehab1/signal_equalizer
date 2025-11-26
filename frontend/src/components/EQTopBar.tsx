
type AppMode = 'preset' | 'generic' | 'custom';

interface EQTopBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isProcessing: boolean;
}

const MODE_TABS: { id: AppMode; label: string; description: string }[] = [
  { id: 'preset', label: 'Basic', description: 'Studio presets' },
  { id: 'generic', label: 'Advanced', description: 'Custom bands' },
  { id: 'custom', label: 'Expert', description: 'DSP & AI' },
];

export function EQTopBar({ mode, onModeChange, isProcessing }: EQTopBarProps) {
  return (
    <div className="eq-topbar">
      <div className="eq-topbar__brand">
        <button className="eq-icon-btn" aria-label="Open settings">
          ⚙️
        </button>
        <span className="eq-topbar__label">EQ:</span>
      </div>

      <div className="eq-topbar__tabs" role="tablist">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={mode === tab.id}
            className={`eq-topbar__tab ${mode === tab.id ? 'active' : ''}`}
            onClick={() => onModeChange(tab.id)}
          >
            <span className="eq-topbar__tab-label">{tab.label}</span>
            <span className="eq-topbar__tab-caption">{tab.description}</span>
          </button>
        ))}
      </div>

      <div className="eq-topbar__status">
        <span className={`eq-led ${isProcessing ? 'eq-led--active' : ''}`} aria-label={isProcessing ? 'Processing audio' : 'Idle'}></span>
        <span className="eq-status-text">{isProcessing ? 'Processing' : 'Ready'}</span>
        <button className="eq-icon-btn" aria-label="Headphone monitor">
          🎧
        </button>
      </div>
    </div>
  );
}
