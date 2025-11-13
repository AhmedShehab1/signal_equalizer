/**
 * Customized Mode Panel: Renders multi-window sliders for advanced EQ modes
 * or AI-based speech separation controls (DSP vs AI toggle)
 */

import { useState, useEffect } from 'react';
import { CustomizedMode, SliderSpec, BandSpec } from '../model/types';
import { loadCustomizedMode, initializeSliderScales, validateScale, buildBandSpecsFromSliders } from '../lib/modes';
import { AVAILABLE_CUSTOMIZED_MODES } from '../config/customizedModes';
import { separateSpeechAudio, separateAudio, processSampleAudio, processSpeechSample, getSourceLabel, type SpeechSeparationResult, type SeparationResult } from '../lib/api';
import { mixSources } from '../lib/audioMixer';

type ProcessingMode = 'dsp' | 'ai';
type ContentType = 'music' | 'speech';
type ModelType = 'demucs' | 'dprnn';

// Cache interface for AI separation results
interface AISeparationCache {
  speechResult: SpeechSeparationResult | null;
  musicResult: SeparationResult | null;
  sourceGains: Record<string, number>;
  sourceBuffers: Record<string, AudioBuffer>;
  timestamp: number;
  fileName: string;
  contentType: ContentType;
  modelType: ModelType;
}

interface CustomizedModePanelProps {
  onBandSpecsChange: (bandSpecs: BandSpec[]) => void;
  disabled?: boolean;
  audioFile?: File | null;
  onAudioMixed?: (mixedBuffer: AudioBuffer) => void;
  aiCache?: AISeparationCache | null;
  onAICacheUpdate?: (
    result: SpeechSeparationResult | SeparationResult | null,
    sourceGains: Record<string, number>,
    sourceBuffers: Record<string, AudioBuffer>,
    contentType: ContentType,
    modelType: ModelType
  ) => void;
  activeTab?: 'dsp' | 'ai';
  onTabChange?: (tab: 'dsp' | 'ai') => void;
}

export default function CustomizedModePanel({ 
  onBandSpecsChange, 
  disabled = false, 
  audioFile = null, 
  onAudioMixed,
  aiCache = null,
  onAICacheUpdate,
  activeTab = 'dsp',
  onTabChange
}: CustomizedModePanelProps) {
  // Content type selection with session persistence
  const [contentType, setContentType] = useState<ContentType>(() => {
    const saved = sessionStorage.getItem('customizedMode:contentType');
    return (saved === 'music' || saved === 'speech') ? saved : 'speech';
  });
  
  // Processing mode state - controlled by parent or local
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(activeTab);
  
  // DSP mode state (existing)
  const [currentMode, setCurrentMode] = useState<CustomizedMode | null>(null);
  const [currentModeId, setCurrentModeId] = useState<string>('');
  const [sliderScales, setSliderScales] = useState<Record<string, number>>({});
  
  // AI mode state - now supports both speech and music
  const [speechResult, setSpeechResult] = useState<SpeechSeparationResult | null>(null);
  const [musicResult, setMusicResult] = useState<SeparationResult | null>(null);
  const [sourceGains, setSourceGains] = useState<Record<string, number>>({});
  const [aiProcessing, setAiProcessing] = useState<boolean>(false);
  const [sourceBuffers, setSourceBuffers] = useState<Record<string, AudioBuffer>>({});
  const [playingSource, setPlayingSource] = useState<string | null>(null);
  const [soloedSource, setSoloedSource] = useState<string | null>(null);
  const [audioContext] = useState<AudioContext>(() => new AudioContext());
  const [currentSourceNode, setCurrentSourceNode] = useState<AudioBufferSourceNode | null>(null);
  
  // Shared state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Persist content type selection to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('customizedMode:contentType', contentType);
  }, [contentType]);

  // Handler for content type switch - resets AI results
  const handleContentTypeChange = (newType: ContentType) => {
    if (newType === contentType) return;
    
    setContentType(newType);
    
    // Clear AI results when switching content type
    setSpeechResult(null);
    setMusicResult(null);
    setSourceGains({});
    setSourceBuffers({});
    setError(null);
    
    // Clear cache if parent tracks it
    if (onAICacheUpdate) {
      onAICacheUpdate(null, {}, {}, newType, newType === 'speech' ? 'dprnn' : 'demucs');
    }
  };

  // Combined effect: sync tab state and restore cache with playback rehydration
  useEffect(() => {
    // First, sync processing mode with parent activeTab
    if (activeTab !== processingMode) {
      setProcessingMode(activeTab);
      return; // Exit early to avoid doing work during sync
    }

    // Then, restore from cache when in AI mode
    // Guard: only restore if cache fileName matches current audioFile AND content type matches
    if (
      processingMode === 'ai' && 
      aiCache && 
      !speechResult && 
      !musicResult &&
      audioFile && 
      aiCache.fileName === audioFile.name &&
      aiCache.contentType === contentType
    ) {
      // Restore cached results based on content type
      if (contentType === 'speech') {
        setSpeechResult(aiCache.speechResult);
      } else {
        setMusicResult(aiCache.musicResult);
      }
      setSourceGains(aiCache.sourceGains);
      setSourceBuffers(aiCache.sourceBuffers);
      
      // Rehydrate playback: remix and notify parent immediately
      if (onAudioMixed && Object.keys(aiCache.sourceBuffers).length > 0) {
        const mixed = mixSources(aiCache.sourceBuffers, aiCache.sourceGains, audioContext);
        onAudioMixed(mixed);
      }
    }
  }, [activeTab, processingMode, aiCache, speechResult, musicResult, onAudioMixed, audioFile, contentType]);

  // Mode switching handler - ensures mutual exclusivity
  const handleModeSwitch = (newMode: ProcessingMode) => {
    if (newMode === processingMode) return;
    
    setProcessingMode(newMode);
    setError(null);
    
    // Notify parent of tab change
    if (onTabChange) {
      onTabChange(newMode);
    }
    
    if (newMode === 'dsp') {
      // Clear AI state when switching to DSP (don't clear cache)
      setSpeechResult(null);
      setMusicResult(null);
      setSourceGains({});
      setSourceBuffers({});
      setAiProcessing(false);
    } else {
      // Clear DSP state when switching to AI
      setSliderScales({});
      onBandSpecsChange([]);
    }
  };

  // AI mode: Handle file processing (supports both speech and music)
  const handleProcessAudio = async () => {
    if (!audioFile) {
      setError('Please select an audio file first');
      return;
    }

    setAiProcessing(true);
    setError(null);

    try {
      if (contentType === 'speech') {
        // Process with DPRNN for speech
        const result = await separateSpeechAudio(audioFile, 8); // 8 second max
        setSpeechResult(result);
        setMusicResult(null);
        
        // Convert sources to AudioBuffers
        const buffers = await convertSpeechSourcesToBuffers(result);
        setSourceBuffers(buffers);
        
        // Initialize gain controls for each source
        const initialGains: Record<string, number> = {};
        Object.keys(result.sources).forEach(sourceKey => {
          initialGains[sourceKey] = 1.0; // Default gain = 1.0
        });
        setSourceGains(initialGains);
        
        // Create initial mix with default gains
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
        // Save to cache via parent callback
        if (onAICacheUpdate) {
          onAICacheUpdate(result, initialGains, buffers, 'speech', 'dprnn');
        }
      } else {
        // Process with Demucs for music
        const result = await separateAudio(audioFile, 5.0, 0.1); // Faster default
        setMusicResult(result);
        setSpeechResult(null);
        
        // Convert sources to AudioBuffers
        const buffers = await convertMusicSourcesToBuffers(result);
        setSourceBuffers(buffers);
        
        // Initialize gain controls for each source (drums, bass, vocals, other)
        const initialGains: Record<string, number> = {};
        Object.keys(result.sources).forEach(sourceKey => {
          initialGains[sourceKey] = 1.0;
        });
        setSourceGains(initialGains);
        
        // Create initial mix with default gains
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
        // Save to cache via parent callback
        if (onAICacheUpdate) {
          onAICacheUpdate(result, initialGains, buffers, 'music', 'demucs');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process audio');
      setSpeechResult(null);
      setMusicResult(null);
    } finally {
      setAiProcessing(false);
    }
  };

  // AI mode: Process demo sample (based on content type)
  const handleProcessDemo = async () => {
    setAiProcessing(true);
    setError(null);

    try {
      if (contentType === 'speech') {
        // Process speech demo with DPRNN
        const result = await processSpeechSample(8); // 8 second max
        setSpeechResult(result);
        setMusicResult(null);
        
        // Convert sources to AudioBuffers
        const buffers = await convertSpeechSourcesToBuffers(result);
        setSourceBuffers(buffers);
        
        // Initialize gain controls
        const initialGains: Record<string, number> = {};
        Object.keys(result.sources).forEach(sourceKey => {
          initialGains[sourceKey] = 1.0;
        });
        setSourceGains(initialGains);
        
        // Create initial mix
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
        // Save to cache
        if (onAICacheUpdate) {
          onAICacheUpdate(result, initialGains, buffers, 'speech', 'dprnn');
        }
      } else {
        // Process music demo with Demucs
        const result = await processSampleAudio(5.0, 0.1); // Faster default
        setMusicResult(result);
        setSpeechResult(null);
        
        // Convert sources to AudioBuffers
        const buffers = await convertMusicSourcesToBuffers(result);
        setSourceBuffers(buffers);
        
        // Initialize gain controls
        const initialGains: Record<string, number> = {};
        Object.keys(result.sources).forEach(sourceKey => {
          initialGains[sourceKey] = 1.0;
        });
        setSourceGains(initialGains);
        
        // Create initial mix
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
        // Save to cache
        if (onAICacheUpdate) {
          onAICacheUpdate(result, initialGains, buffers, 'music', 'demucs');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process demo sample');
      setSpeechResult(null);
      setMusicResult(null);
    } finally {
      setAiProcessing(false);
    }
  };

  // AI mode: Handle source gain changes
  const handleSourceGainChange = (sourceKey: string, gain: number) => {
    setSourceGains(prev => {
      const updated = { ...prev, [sourceKey]: gain };
      
      // Remix audio with NEW gains immediately (inside setter to avoid stale closure)
      if ((speechResult || musicResult) && Object.keys(sourceBuffers).length > 0 && onAudioMixed) {
        try {
          const mixed = mixSources(sourceBuffers, updated, audioContext);
          onAudioMixed(mixed);
        } catch (err) {
          console.error('[handleSourceGainChange] Failed to remix:', err);
        }
      }
      
      // Update cache with new gains
      if (onAICacheUpdate && (speechResult || musicResult) && Object.keys(sourceBuffers).length > 0) {
        const result = speechResult || musicResult;
        const modelType = speechResult ? 'dprnn' : 'demucs';
        onAICacheUpdate(result!, updated, sourceBuffers, contentType, modelType);
      }
      
      return updated;
    });
  };

  // Convert speech separation result to AudioBuffers
  const convertSpeechSourcesToBuffers = async (result: SpeechSeparationResult): Promise<Record<string, AudioBuffer>> => {
    const buffers: Record<string, AudioBuffer> = {};
    
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
      
      buffers[sourceKey] = buffer;
    }
    
    return buffers;
  };

  // Convert music separation result to AudioBuffers (from Demucs)
  const convertMusicSourcesToBuffers = async (result: SeparationResult): Promise<Record<string, AudioBuffer>> => {
    const buffers: Record<string, AudioBuffer> = {};
    
    // Demucs returns drums, bass, vocals, other
    const sourceNames = ['drums', 'bass', 'vocals', 'other'] as const;
    
    for (const sourceName of sourceNames) {
      const sourceData = result.sources[sourceName];
      if (!sourceData) continue;
      
      // Convert audio data to AudioBuffer
      const numChannels = sourceData.audio_shape[0];
      const numSamples = sourceData.audio_shape[1];
      
      const buffer = audioContext.createBuffer(
        numChannels,
        numSamples,
        result.sample_rate
      );
      
      // Fill audio buffer with data
      for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < numSamples; i++) {
          channelData[i] = sourceData.audio_data[channel][i];
        }
      }
      
      buffers[sourceName] = buffer;
    }
    
    return buffers;
  };

  // Play individual source
  const playSource = (sourceKey: string) => {
    const buffer = sourceBuffers[sourceKey];
    if (!buffer) return;
    
    // Stop current playback
    stopPlayback();
    
    // Create source node
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    
    // Apply gain
    const gainNode = audioContext.createGain();
    gainNode.gain.value = sourceGains[sourceKey] ?? 1.0;
    
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
    const currentGain = sourceGains[sourceKey] ?? 1.0;
    const newGain = currentGain === 0 ? 1.0 : 0;
    handleSourceGainChange(sourceKey, newGain);
  };

  // Solo/unsolo source (mutes all others)
  const toggleSolo = (sourceKey: string) => {
    if (soloedSource === sourceKey) {
      // Unsolo: restore all sources to gain 1.0
      setSoloedSource(null);
      const restoredGains: Record<string, number> = {};
      Object.keys(sourceBuffers).forEach(key => {
        restoredGains[key] = 1.0;
      });
      setSourceGains(restoredGains);
      
      // Remix with restored gains
      if (speechResult && onAudioMixed) {
        try {
          const mixed = mixSources(sourceBuffers, restoredGains, audioContext);
          onAudioMixed(mixed);
        } catch (err) {
          console.error('[toggleSolo] Failed to remix on unsolo:', err);
        }
      }
    } else {
      // Solo: set this source to 1.0, all others to 0
      setSoloedSource(sourceKey);
      const soloGains: Record<string, number> = {};
      Object.keys(sourceBuffers).forEach(key => {
        soloGains[key] = key === sourceKey ? 1.0 : 0;
      });
      setSourceGains(soloGains);
      
      // Remix with solo gains
      if (speechResult && onAudioMixed) {
        try {
          const mixed = mixSources(sourceBuffers, soloGains, audioContext);
          onAudioMixed(mixed);
        } catch (err) {
          console.error('[toggleSolo] Failed to remix on solo:', err);
        }
      }
    }
    
    // Update cache
    if (onAICacheUpdate && (speechResult || musicResult)) {
      const result = speechResult || musicResult;
      const modelType = speechResult ? 'dprnn' : 'demucs';
      onAICacheUpdate(result!, sourceGains, sourceBuffers, contentType, modelType);
    }
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
      // Convert Map to Record for React state
      const scalesRecord = Object.fromEntries(initialScales);
      setSliderScales(scalesRecord);
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
    const updatedScales = { ...sliderScales, [sliderId]: validatedValue };
    setSliderScales(updatedScales);
    
    // Convert back to Map for buildBandSpecsFromSliders
    const scalesMap = new Map(Object.entries(updatedScales));
    const bandSpecs = buildBandSpecsFromSliders(currentMode.sliders, scalesMap);
    onBandSpecsChange(bandSpecs);
  };

  const handleReset = () => {
    if (!currentMode) return;
    const defaultScales = initializeSliderScales(currentMode.sliders);
    const scalesRecord = Object.fromEntries(defaultScales);
    setSliderScales(scalesRecord);
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
            AI Separation
          </button>
        </div>
      </div>

      {/* Content Type Selection (visible in AI mode) */}
      {processingMode === 'ai' && (
        <div className="content-type-selector">
          <label className="toggle-label">Content Type:</label>
          <div className="toggle-buttons">
            <button
              className={`toggle-button ${contentType === 'speech' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('speech')}
              disabled={disabled || aiProcessing}
              title="Separate speech/vocals from background noise and music"
            >
              🎤 Speech/Vocals
            </button>
            <button
              className={`toggle-button ${contentType === 'music' ? 'active' : ''}`}
              onClick={() => handleContentTypeChange('music')}
              disabled={disabled || aiProcessing}
              title="Separate music into drums, bass, vocals, and other instruments"
            >
              🎵 Music
            </button>
          </div>
          <p className="content-type-hint">
            {contentType === 'speech' 
              ? '💡 Best for: podcasts, interviews, voice recordings. Uses DPRNN model.' 
              : '💡 Best for: songs, instrumentals. Separates into drums, bass, vocals, other. Uses Hybrid Demucs.'}
          </p>
        </div>
      )}

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
                value={sliderScales[slider.id] ?? slider.defaultScale}
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
            <h2>{contentType === 'speech' ? 'Speech Source Separation' : 'Music Source Separation'}</h2>
            <p className="mode-description">
              {contentType === 'speech' 
                ? 'Upload audio to separate speech sources using AI (DPRNN). Detects and isolates different speakers and background.'
                : 'Upload audio to separate music using AI (Hybrid Demucs). Separates into drums, bass, vocals, and other instruments.'}
            </p>
          </div>

          <div className="ai-actions">
            <button
              onClick={handleProcessAudio}
              disabled={!audioFile || aiProcessing || disabled}
              className="process-button"
            >
              {aiProcessing ? 'Processing...' : ((speechResult || musicResult) ? 'Re-separate Sources' : 'Separate Sources')}
            </button>
            <button
              onClick={handleProcessDemo}
              disabled={aiProcessing || disabled}
              className="demo-button"
            >
              {aiProcessing ? 'Processing...' : `Try ${contentType === 'speech' ? 'Speech' : 'Music'} Demo`}
            </button>
            {!audioFile && (
              <p className="info-message">💡 Upload an audio file or try the demo to get started</p>
            )}
            {aiCache && !speechResult && !musicResult && aiCache.contentType === contentType && (
              <p className="cache-info">
                ℹ️ Previous results available from {new Date(aiCache.timestamp).toLocaleTimeString()}
                {' - '}restored automatically
              </p>
            )}
            {(speechResult || musicResult) && aiCache && aiCache.timestamp && (
              <p className="cache-timestamp">
                Last processed: {new Date(aiCache.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Speech Results */}
          {speechResult && contentType === 'speech' && (
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
                          onClick={() => toggleSolo(sourceKey)}
                          disabled={disabled}
                          className={`solo-button ${soloedSource === sourceKey ? 'soloed' : ''}`}
                          title={soloedSource === sourceKey ? 'Unsolo (restore all)' : 'Solo (mute others)'}
                        >
                          {soloedSource === sourceKey ? '🎵 Solo' : '🎵 Solo'}
                        </button>
                        <button
                          onClick={() => toggleMute(sourceKey)}
                          disabled={disabled}
                          className={`mute-button ${sourceGains[sourceKey] === 0 ? 'muted' : ''}`}
                          title={sourceGains[sourceKey] === 0 ? 'Unmute' : 'Mute'}
                        >
                          {sourceGains[sourceKey] === 0 ? '🔇 Muted' : '🔊 Mute'}
                        </button>
                        <span className="gain-value">
                          {(sourceGains[sourceKey] ?? 1.0).toFixed(2)}×
                        </span>
                      </div>
                    </div>
                    <input
                      id={`gain-${sourceKey}`}
                      type="range"
                      min="0"
                      max="2"
                      step="0.01"
                      value={sourceGains[sourceKey] ?? 1.0}
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

          {/* Music Results (Demucs) */}
          {musicResult && contentType === 'music' && (
            <div className="source-controls">
              <div className="source-controls-header">
                <h3>Detected Sources: 4 (Drums, Bass, Vocals, Other)</h3>
                <button
                  onClick={stopPlayback}
                  disabled={!playingSource}
                  className="stop-all-button"
                >
                  ⏹ Stop Playback
                </button>
              </div>
              <div className="sources-container">
                {Object.entries(musicResult.sources).map(([sourceKey, sourceData]) => (
                  <div key={sourceKey} className="source-control">
                    <div className="source-header">
                      <label htmlFor={`gain-${sourceKey}`}>
                        {sourceKey.charAt(0).toUpperCase() + sourceKey.slice(1)}
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
                          onClick={() => toggleSolo(sourceKey)}
                          disabled={disabled}
                          className={`solo-button ${soloedSource === sourceKey ? 'soloed' : ''}`}
                          title={soloedSource === sourceKey ? 'Unsolo (restore all)' : 'Solo (mute others)'}
                        >
                          {soloedSource === sourceKey ? '🎵 Solo' : '🎵 Solo'}
                        </button>
                        <button
                          onClick={() => toggleMute(sourceKey)}
                          disabled={disabled}
                          className={`mute-button ${sourceGains[sourceKey] === 0 ? 'muted' : ''}`}
                          title={sourceGains[sourceKey] === 0 ? 'Unmute' : 'Mute'}
                        >
                          {sourceGains[sourceKey] === 0 ? '🔇 Muted' : '🔊 Mute'}
                        </button>
                        <span className="gain-value">
                          {(sourceGains[sourceKey] ?? 1.0).toFixed(2)}×
                        </span>
                      </div>
                    </div>
                    <input
                      id={`gain-${sourceKey}`}
                      type="range"
                      min="0"
                      max="2"
                      step="0.01"
                      value={sourceGains[sourceKey] ?? 1.0}
                      onChange={(e) => handleSourceGainChange(sourceKey, parseFloat(e.target.value))}
                      disabled={disabled}
                      className="gain-slider"
                    />
                    <div className="source-info">
                      <span className="source-shape">
                        Shape: {sourceData.audio_shape.join(' × ')}
                      </span>
                      {sourceData.spectrogram && (
                        <img
                          src={sourceData.spectrogram}
                          alt={`${sourceKey} spectrogram`}
                          className="source-spectrogram"
                        />
                      )}
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
