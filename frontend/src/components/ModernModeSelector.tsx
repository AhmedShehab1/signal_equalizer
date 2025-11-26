/**
 * ModernModeSelector Component - Example Implementation
 * Demonstrates the new design system in action
 * 
 * This is a reference implementation showing how to use:
 * - Glass-morphic panels
 * - CSS variables from design system
 * - Modern interaction patterns
 * - Responsive design
 */

import { useState } from 'react';
import './ModernModeSelector.css';

interface Mode {
  id: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
}

interface ModernModeSelectorProps {
  currentMode: string;
  onModeChange: (modeId: string) => void;
  isProcessing?: boolean;
}

const modes: Mode[] = [
  {
    id: 'preset',
    icon: '🎵',
    title: 'Preset Modes',
    description: 'Quick EQ presets for common scenarios',
  },
  {
    id: 'generic',
    icon: '⚡',
    title: 'Generic Mode',
    description: 'Create custom frequency bands',
  },
  {
    id: 'custom-dsp',
    icon: '🎛️',
    title: 'Custom DSP',
    description: 'Advanced multi-window EQ controls',
  },
  {
    id: 'ai-separation',
    icon: '🤖',
    title: 'AI Separation',
    description: 'Source separation with neural networks',
    badge: 'AI',
  },
];

export function ModernModeSelector({
  currentMode,
  onModeChange,
  isProcessing = false,
}: ModernModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<string | null>(null);

  return (
    <div className="modern-mode-selector">
      {/* Header */}
      <div className="selector-header">
        <h3 className="selector-title">Processing Modes</h3>
        <p className="selector-subtitle">Choose your workflow</p>
      </div>

      {/* Mode Grid */}
      <div className="mode-grid">
        {modes.map((mode) => (
          <button
            key={mode.id}
            className={`
              mode-card
              ${currentMode === mode.id ? 'mode-card-active' : ''}
              ${hoveredMode === mode.id ? 'mode-card-hovered' : ''}
            `}
            onClick={() => !isProcessing && onModeChange(mode.id)}
            onMouseEnter={() => setHoveredMode(mode.id)}
            onMouseLeave={() => setHoveredMode(null)}
            disabled={isProcessing}
            aria-pressed={currentMode === mode.id}
            aria-label={`Switch to ${mode.title}`}
          >
            {/* Badge */}
            {mode.badge && (
              <span className="mode-badge badge badge-accent">
                {mode.badge}
              </span>
            )}

            {/* Icon */}
            <div className="mode-card-icon">
              {mode.icon}
            </div>

            {/* Content */}
            <div className="mode-card-content">
              <h4 className="mode-card-title">{mode.title}</h4>
              <p className="mode-card-description">{mode.description}</p>
            </div>

            {/* Active Indicator */}
            {currentMode === mode.id && (
              <div className="mode-card-indicator">
                <span className="indicator-dot"></span>
                Active
              </div>
            )}

            {/* Processing Indicator */}
            {isProcessing && currentMode === mode.id && (
              <div className="mode-card-processing">
                <div className="spinner"></div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Info Footer */}
      <div className="selector-footer">
        <div className="info-box">
          <span className="info-icon">💡</span>
          <p className="info-text">
            Tip: Each mode offers unique audio processing capabilities. 
            Experiment to find the perfect sound!
          </p>
        </div>
      </div>
    </div>
  );
}

export default ModernModeSelector;
