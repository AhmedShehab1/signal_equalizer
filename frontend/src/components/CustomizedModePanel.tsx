/**
 * Customized Mode Panel: Renders multi-window sliders for advanced EQ modes
 * or AI-based speech separation controls (DSP vs AI toggle)
 */

import { useState, useEffect } from 'react';
import { CustomizedMode, SliderSpec, BandSpec } from '../model/types';
import { loadCustomizedMode, initializeSliderScales, validateScale, buildBandSpecsFromSliders } from '../lib/modes';
import { AVAILABLE_CUSTOMIZED_MODES } from '../config/customizedModes';
import { separateSpeechAudio, getSourceLabel, type SpeechSeparationResult } from '../lib/api';

type ProcessingMode = 'dsp' | 'ai';

interface CustomizedModePanelProps {
  onBandSpecsChange: (bandSpecs: BandSpec[]) => void;
  disabled?: boolean;
  audioFile?: File | null;
  onAudioMixed?: (mixedBuffer: AudioBuffer) => void; // Callback for AI mixed audio
}

export default function CustomizedModePanel({ onBandSpecsChange, disabled = false, audioFile = null, onAudioMixed }: CustomizedModePanelProps) {
  // Processing mode state
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('dsp');
  
  // DSP mode state (existing)
  const [currentMode, setCurrentMode] = useState<CustomizedMode | null>(null);
  const [currentModeId, setCurrentModeId] = useState<string>('');
  const [sliderScales, setSliderScales] = useState<Map<string, number>>(new Map());
  
  // AI mode state
  const [speechResult, setSpeechResult] = useState<SpeechSeparationResult | null>(null);
  const [sourceGains, setSourceGains] = useState<Map<string, number>>(new Map());
  const [aiProcessing, setAiProcessing] = useState<boolean>(false);
  const [sourceBuffers, setSourceBuffers] = useState<Map<string, AudioBuffer>>(new Map());
  const [playingSource, setPlayingSource] = useState<string | null>(null); // Track which source is playing
  const [audioContext] = useState<AudioContext>(() => new AudioContext());
  const [currentSourceNode, setCurrentSourceNode] = useState<AudioBufferSourceNode | null>(null);
  
  // Shared state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Mode switching handler - ensures mutual exclusivity
  const handleModeSwitch = (newMode: ProcessingMode) => {
    if (newMode === processingMode) return;
    
    setProcessingMode(newMode);
    setError(null);
    
    if (newMode === 'dsp') {
      // Clear AI state when switching to DSP
      setSpeechResult(null);
      setSourceGains(new Map());
      setAiProcessing(false);
    } else {
      // Clear DSP state when switching to AI
      setSliderScales(new Map());
      onBandSpecsChange([]);
    }
  };

  // AI mode: Handle file processing
  const handleProcessAudio = async () => {
    if (!audioFile) {
      setError('Please select an audio file first');
      return;
    }

    setAiProcessing(true);
    setError(null);

    try {
      const result = await separateSpeechAudio(audioFile, 8); // 8 second max
      setSpeechResult(result);
      
      // Convert sources to AudioBuffers
      const buffers = await convertSourcesToBuffers(result);
      setSourceBuffers(buffers);
      
      // Initialize gain controls for each source
      const initialGains = new Map<string, number>();
      Object.keys(result.sources).forEach(sourceKey => {
        initialGains.set(sourceKey, 1.0); // Default gain = 1.0
      });
      setSourceGains(initialGains);
      
      // Create initial mix with default gains
      if (onAudioMixed) {
        const mixed = mixSources(buffers, initialGains);
        onAudioMixed(mixed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      setSpeechResult(null);
    } finally {
      setAiProcessing(false);
    }
  };

  // AI mode: Handle source gain changes
  const handleSourceGainChange = (sourceKey: string, gain: number) => {
    setSourceGains(prev => {
      const updated = new Map(prev);
      updated.set(sourceKey, gain);
      return updated;
    });
    
    // Remix audio with new gains
    if (speechResult && sourceBuffers.size > 0) {
      mixAndNotifyParent();
    }
  };

  // Convert speech separation result to AudioBuffers
  const convertSourcesToBuffers = async (result: SpeechSeparationResult): Promise<Map<string, AudioBuffer>> => {
    const buffers = new Map<string, AudioBuffer>();
    
    for (const [sourceKey, sourceData] of Object.entries(result.sources)) {
      const audioData = sourceData.audio_data;
      const sampleRate = result.sample_rate;
      
      // Create AudioBuffer (mono audio)
      const buffer = audioContext.createBuffer(1, audioData.length, sampleRate);
      const channelData = buffer.getChannelData(0);
      
      // Copy audio data
      for (let i = 0; i < audioData.length; i++) {
        channelData[i] = audioData[i];
      }
      
      buffers.set(sourceKey, buffer);
    }
    
    return buffers;
  };

  // Mix all sources with their respective gains
  const mixSources = (buffers: Map<string, AudioBuffer>, gains: Map<string, number>): AudioBuffer => {
    if (buffers.size === 0) {
      throw new Error('No source buffers to mix');
    }
    
    // Get first buffer to determine size and sample rate
    const firstBuffer = Array.from(buffers.values())[0];
    const length = firstBuffer.length;
    const sampleRate = firstBuffer.sampleRate;
    
    // Create output buffer (mono)
    const mixedBuffer = audioContext.createBuffer(1, length, sampleRate);
    const mixedData = mixedBuffer.getChannelData(0);
    
    // Mix all sources
    for (const [sourceKey, buffer] of buffers.entries()) {
      const gain = gains.get(sourceKey) ?? 1.0;
      const sourceData = buffer.getChannelData(0);
      
      for (let i = 0; i < length; i++) {
        mixedData[i] += sourceData[i] * gain;
      }
    }
    
    // Normalize to prevent clipping
    let maxVal = 0;
    for (let i = 0; i < length; i++) {
      maxVal = Math.max(maxVal, Math.abs(mixedData[i]));
    }
    if (maxVal > 1.0) {
      for (let i = 0; i < length; i++) {
        mixedData[i] /= maxVal;
      }
    }
    
    return mixedBuffer;
  };

  // Mix sources and notify parent component
  const mixAndNotifyParent = () => {
    if (!speechResult || sourceBuffers.size === 0 || !onAudioMixed) return;
    
    try {
      const mixed = mixSources(sourceBuffers, sourceGains);
      onAudioMixed(mixed);
    } catch (err) {
      console.error('Failed to mix sources:', err);
      setError('Failed to mix audio sources');
    }
  };

  // Play individual source
  const playSource = (sourceKey: string) => {
    const buffer = sourceBuffers.get(sourceKey);
    if (!buffer) return;
    
    // Stop current playback
    stopPlayback();
    
    // Create source node
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    
    // Apply gain
    const gainNode = audioContext.createGain();
    gainNode.gain.value = sourceGains.get(sourceKey) ?? 1.0;
    
    // Connect and play
    sourceNode.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    sourceNode.onended = () => {
      setPlayingSource(null);
      setCurrentSourceNode(null);
    };
    
    sourceNode.start(0);
    setCurrentSourceNode(sourceNode);
    setPlayingSource(sourceKey);
  };

  // Stop current playback
  const stopPlayback = () => {
    if (currentSourceNode) {
      try {
        currentSourceNode.stop();
      } catch (e) {
        // Already stopped
      }
      setCurrentSourceNode(null);
    }
    setPlayingSource(null);
  };

  // Mute/unmute source (set gain to 0 or restore)
  const toggleMute = (sourceKey: string) => {
    const currentGain = sourceGains.get(sourceKey) ?? 1.0;
    const newGain = currentGain === 0 ? 1.0 : 0;
    handleSourceGainChange(sourceKey, newGain);
  };

  // Load first mode on mount
  useEffect(() => {
    const loadInitialMode = async () => {
      if (AVAILABLE_CUSTOMIZED_MODES.length > 0) {
        await handleModeSelect(AVAILABLE_CUSTOMIZED_MODES[0]);
      }
    };
    loadInitialMode();
  }, [])

  const handleModeSelect = async (modeName: string) => {
    setLoading(true);
    setError(null);

    try {
      const mode = await loadCustomizedMode(modeName);
      setCurrentMode(mode);
      setCurrentModeId(modeName); // Track the mode ID
      
      const initialScales = initializeSliderScales(mode.sliders);
      setSliderScales(initialScales);
      const bandSpecs = buildBandSpecsFromSliders(mode.sliders, initialScales);
      onBandSpecsChange(bandSpecs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mode');
      console.error('Mode load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    handleModeSelect(event.target.value);
  };

  const handleSliderChange = (sliderId: string, value: number) => {
    if (!currentMode) return;
    
    const validatedValue = validateScale(value);
    const updatedScales = new Map(sliderScales);
    updatedScales.set(sliderId, validatedValue);
    setSliderScales(updatedScales);
    
    const bandSpecs = buildBandSpecsFromSliders(currentMode.sliders, updatedScales);
    onBandSpecsChange(bandSpecs);
  };

  const handleReset = () => {
    if (!currentMode) return;
    const defaultScales = initializeSliderScales(currentMode.sliders);
    setSliderScales(defaultScales);
    const bandSpecs = buildBandSpecsFromSliders(currentMode.sliders, defaultScales);
    onBandSpecsChange(bandSpecs);
  };

  if (loading) {
    return (
      <div className="customized-mode-panel">
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading mode...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customized-mode-panel">
        <div className="error-message">
          <p>{error}</p>
          {processingMode === 'dsp' ? (
            <button onClick={() => handleModeSelect(AVAILABLE_CUSTOMIZED_MODES[0])}>
              Retry
            </button>
          ) : (
            <button onClick={handleProcessAudio} disabled={!audioFile || aiProcessing}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="customized-mode-panel">
      {/* Processing Mode Toggle */}
      <div className="processing-mode-toggle">
        <label className="toggle-label">Processing Mode:</label>
        <div className="toggle-buttons">
          <button
            className={`toggle-button ${processingMode === 'dsp' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('dsp')}
            disabled={disabled || loading || aiProcessing}
          >
            DSP (Band EQ)
          </button>
          <button
            className={`toggle-button ${processingMode === 'ai' ? 'active' : ''}`}
            onClick={() => handleModeSwitch('ai')}
            disabled={disabled || loading}
          >
            AI (Speech Separation)
          </button>
        </div>
      </div>

      {/* DSP Mode Rendering */}
      {processingMode === 'dsp' && currentMode && (
        <>
          <div className="mode-header">
            <div className="mode-info">
              <h2>{currentMode.name}</h2>
              <p className="mode-description">{currentMode.description}</p>
            </div>
            <div className="mode-actions">
              <select 
                className="mode-selector-dropdown"
                value={currentModeId}
                onChange={handleModeSelectChange}
                disabled={disabled || loading}
                aria-label="Select customized EQ mode"
              >
                {AVAILABLE_CUSTOMIZED_MODES.map((modeName: string) => (
                  <option key={modeName} value={modeName}>
                    {modeName.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </option>
                ))}
              </select>
              <button onClick={handleReset} disabled={disabled} className="reset-button">
                Reset to Defaults
              </button>
            </div>
          </div>

          <fieldset disabled={disabled} className="sliders-container">
            {currentMode.sliders.map((slider) => (
              <MultiWindowSlider
                key={slider.id}
                slider={slider}
                value={sliderScales.get(slider.id) ?? slider.defaultScale}
                onChange={(value) => handleSliderChange(slider.id, value)}
              />
            ))}
          </fieldset>
        </>
      )}

      {/* AI Mode Rendering */}
      {processingMode === 'ai' && (
        <div className="ai-mode-container">
          <div className="ai-mode-header">
            <h2>Speech Source Separation</h2>
            <p className="mode-description">
              Upload audio to separate speech sources using AI. Adjust gain for each detected source.
            </p>
          </div>

          <div className="ai-actions">
            <button
              onClick={handleProcessAudio}
              disabled={!audioFile || aiProcessing || disabled}
              className="process-button"
            >
              {aiProcessing ? 'Processing...' : 'Separate Sources'}
            </button>
            {!audioFile && (
              <p className="info-message">Please select an audio file first</p>
            )}
          </div>

          {speechResult && (
            <div className="source-controls">
              <div className="source-controls-header">
                <h3>Detected Sources: {speechResult.num_sources}</h3>
                <button
                  onClick={stopPlayback}
                  disabled={!playingSource}
                  className="stop-all-button"
                >
                  ⏹ Stop Playback
                </button>
              </div>
              <div className="sources-container">
                {Object.entries(speechResult.sources).map(([sourceKey, sourceData]) => (
                  <div key={sourceKey} className="source-control">
                    <div className="source-header">
                      <label htmlFor={`gain-${sourceKey}`}>
                        {getSourceLabel(sourceKey)}
                      </label>
                      <div className="source-actions">
                        <button
                          onClick={() => playSource(sourceKey)}
                          disabled={disabled || playingSource === sourceKey}
                          className="play-button"
                          title="Play this source"
                        >
                          {playingSource === sourceKey ? '⏸ Playing' : '▶ Play'}
                        </button>
                        <button
                          onClick={() => toggleMute(sourceKey)}
                          disabled={disabled}
                          className={`mute-button ${sourceGains.get(sourceKey) === 0 ? 'muted' : ''}`}
                          title={sourceGains.get(sourceKey) === 0 ? 'Unmute' : 'Mute'}
                        >
                          {sourceGains.get(sourceKey) === 0 ? '🔇 Muted' : '🔊 Mute'}
                        </button>
                        <span className="gain-value">
                          {(sourceGains.get(sourceKey) ?? 1.0).toFixed(2)}×
                        </span>
                      </div>
                    </div>
                    <input
                      id={`gain-${sourceKey}`}
                      type="range"
                      min="0"
                      max="2"
                      step="0.01"
                      value={sourceGains.get(sourceKey) ?? 1.0}
                      onChange={(e) => handleSourceGainChange(sourceKey, parseFloat(e.target.value))}
                      disabled={disabled}
                      className="gain-slider"
                    />
                    <div className="source-info">
                      <span className="source-shape">
                        Shape: {sourceData.audio_shape.join(' × ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MultiWindowSliderProps {
  slider: SliderSpec;
  value: number;
  onChange: (value: number) => void;
}

function MultiWindowSlider({ slider, value, onChange }: MultiWindowSliderProps) {
  const windowsText = slider.windows
    .map(w => `${Math.round(w.f_start_hz)}-${Math.round(w.f_end_hz)} Hz`)
    .join(', ');

  return (
    <div className="multi-window-slider">
      <div className="slider-header">
        <label htmlFor={`slider-${slider.id}`}>
          {slider.label}
          <span className="windows-badge" title={`Frequency ranges: ${windowsText}`}>
            {slider.windows.length} {slider.windows.length === 1 ? 'window' : 'windows'}
          </span>
        </label>
        <span className="scale-value" aria-live="polite">
          {value.toFixed(2)}×
        </span>
      </div>
      
      <input
        id={`slider-${slider.id}`}
        type="range"
        min="0"
        max="2"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={`${slider.label} gain control`}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(2)} times`}
        aria-describedby={`windows-${slider.id}`}
      />
      
      <div className="slider-labels">
        <span>0.0× (mute)</span>
        <span>1.0× (unity)</span>
        <span>2.0× (double)</span>
      </div>
      
      <details className="windows-details">
        <summary id={`windows-${slider.id}`}>Frequency Windows</summary>
        <ul className="windows-list">
          {slider.windows.map((window, idx) => (
            <li key={idx}>
              {Math.round(window.f_start_hz)} - {Math.round(window.f_end_hz)} Hz
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
