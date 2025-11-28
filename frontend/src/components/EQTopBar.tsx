
type AppMode = 'generic' | 'custom';

interface EQTopBarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isProcessing: boolean;
}

const MODE_TABS: { id: AppMode; label: string; icon: string; description: string }[] = [
  { id: 'generic', label: 'Advanced', icon: '🎛️', description: 'Generic EQ Bands' },
  { id: 'custom', label: 'Expert', icon: '🧠', description: 'DSP & AI Separation' },
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
            <span className="eq-topbar__tab-icon">{tab.icon}</span>
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
