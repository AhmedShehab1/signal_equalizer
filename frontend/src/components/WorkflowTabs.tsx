/**
 * Modern horizontal workflow tabs - Phase 5 implementation
 * Replaces vertical mode stack with professional tab-based navigation
 */

import './WorkflowTabs.css';

type WorkflowMode = 'preset' | 'generic' | 'custom';

interface WorkflowTab {
  id: WorkflowMode;
  label: string;
  icon: string;
  description: string;
  badge?: string;
  badgeType?: 'primary' | 'accent' | 'success' | 'warning';
}

interface WorkflowTabsProps {
  currentMode: WorkflowMode;
  onModeChange: (mode: WorkflowMode) => void;
  isProcessing?: boolean;
  disabled?: boolean;
}

const WORKFLOW_TABS: WorkflowTab[] = [
  {
    id: 'preset',
    label: 'Preset Modes',
    icon: '🎵',
    description: 'Pre-configured equalizer profiles',
    badge: 'Quick',
    badgeType: 'success',
  },
  {
    id: 'generic',
    label: 'Generic EQ',
    icon: '⚡',
    description: 'User-defined frequency bands',
    badge: 'Custom',
    badgeType: 'primary',
  },
  {
    id: 'custom',
    label: 'Advanced DSP',
    icon: '🎛️',
    description: 'DSP & AI separation tools',
    badge: 'Pro',
    badgeType: 'accent',
  },
];

export default function WorkflowTabs({ 
  currentMode, 
  onModeChange, 
  isProcessing = false,
  disabled = false 
}: WorkflowTabsProps) {
  
  return (
    <div className="workflow-tabs-container">
      <div className="workflow-tabs glass-panel-light">
        {WORKFLOW_TABS.map((tab) => {
          const isActive = currentMode === tab.id;
          const isDisabled = disabled || isProcessing;
          
          return (
            <button
              key={tab.id}
              className={`workflow-tab ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && onModeChange(tab.id)}
              disabled={isDisabled}
              aria-label={`Switch to ${tab.label}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="tab-icon-wrapper">
                <span className="tab-icon" role="img" aria-hidden="true">
                  {tab.icon}
                </span>
                {isActive && isProcessing && (
                  <span className="processing-ring" aria-label="Processing"></span>
                )}
              </div>
              
              <div className="tab-content">
                <div className="tab-header">
                  <span className="tab-label">{tab.label}</span>
                  {tab.badge && (
                    <span className={`badge badge-${tab.badgeType || 'primary'}`}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="tab-description">{tab.description}</span>
              </div>
              
              {isActive && <div className="active-indicator"></div>}
            </button>
          );
        })}
      </div>
      
      {isProcessing && (
        <div className="workflow-status glass-panel-light">
          <span className="status-spinner"></span>
          <span className="status-text">Processing audio...</span>
        </div>
      )}
    </div>
  );
}
