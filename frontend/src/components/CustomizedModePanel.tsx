/**
 * CustomizedModePanel - Orchestrator Component
 * 
 * Coordinates between DSP (Band EQ) and AI (Source Separation) processing modes.
 * Delegates to specialized subcomponents while managing top-level state and cache restoration.
 * 
 * Refactored from 940-line monolith to clean orchestrator pattern.
 */

import { useState, useEffect } from 'react';
import { 
  separateSpeechAudio, 
  separateAudio, 
  processSampleAudio, 
  processSpeechSample,
  type SpeechSeparationResult, 
  type SeparationResult 
} from '../lib/api';
import { mixSources } from '../lib/audioMixer';

// Import refactored components
import { ModeToggle } from './CustomizedMode/ModeToggle';
import { ContentTypeSelector } from './CustomizedMode/ContentTypeSelector';
import { DSPControls } from './CustomizedMode/DSPControls';
import { AIControls } from './CustomizedMode/AIControls';
import { SourceList } from './CustomizedMode/SourceList';
import type { 
  ProcessingMode, 
  ContentType, 
  CustomizedModePanelProps 
} from './CustomizedMode/types';

/**
 * Main orchestrator component
 */
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
  
  // ===== Top-level State Management =====
  
  // Content type with session persistence
  const [contentType, setContentType] = useState<ContentType>(() => {
    const saved = sessionStorage.getItem('customizedMode:contentType');
    return (saved === 'music' || saved === 'speech') ? saved : 'speech';
  });
  
  // Processing mode (controlled by parent or local)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>(activeTab);
  
  // AI mode state
  const [speechResult, setSpeechResult] = useState<SpeechSeparationResult | null>(null);
  const [musicResult, setMusicResult] = useState<SeparationResult | null>(null);
  const [sourceGains, setSourceGains] = useState<Record<string, number>>({});
  const [sourceBuffers, setSourceBuffers] = useState<Record<string, AudioBuffer>>({});
  const [aiProcessing, setAiProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Playback state
  const [playingSource, setPlayingSource] = useState<string | null>(null);
  const [soloedSources, setSoloedSources] = useState<Set<string>>(new Set());
  const [mutedSources, setMutedSources] = useState<Set<string>>(new Set());
  
  // Audio context
  const [audioContext] = useState<AudioContext>(() => new AudioContext());
  const [currentSourceNode, setCurrentSourceNode] = useState<AudioBufferSourceNode | null>(null);

  // ===== Session Persistence =====
  
  useEffect(() => {
    sessionStorage.setItem('customizedMode:contentType', contentType);
  }, [contentType]);

  // ===== Cache Restoration =====
  
  useEffect(() => {
    // Sync processing mode with parent
    if (activeTab !== processingMode) {
      setProcessingMode(activeTab);
      return;
    }

    // Restore from cache when in AI mode
    if (
      processingMode === 'ai' && 
      aiCache && 
      !speechResult && 
      !musicResult &&
      audioFile && 
      aiCache.fileName === audioFile.name &&
      aiCache.contentType === contentType
    ) {
      // Restore appropriate result based on content type
      if (contentType === 'speech') {
        setSpeechResult(aiCache.speechResult);
      } else {
        setMusicResult(aiCache.musicResult);
      }
      setSourceGains(aiCache.sourceGains);
      setSourceBuffers(aiCache.sourceBuffers);
      
      // Rehydrate playback
      if (onAudioMixed && Object.keys(aiCache.sourceBuffers).length > 0) {
        const mixed = mixSources(aiCache.sourceBuffers, aiCache.sourceGains, audioContext);
        onAudioMixed(mixed);
      }
    }
  }, [activeTab, processingMode, aiCache, speechResult, musicResult, onAudioMixed, audioFile, contentType, audioContext]);

  // ===== Mode Switching =====
  
  const handleModeSwitch = (newMode: ProcessingMode) => {
    if (newMode === processingMode) return;
    
    setProcessingMode(newMode);
    setError(null);
    
    if (onTabChange) {
      onTabChange(newMode);
    }
    
    // Clear opposite mode's state
    if (newMode === 'dsp') {
      setSpeechResult(null);
      setMusicResult(null);
      setSourceGains({});
      setSourceBuffers({});
      setAiProcessing(false);
    } else {
      onBandSpecsChange([]);
    }
  };

  const handleContentTypeChange = (newType: ContentType) => {
    if (newType === contentType) return;
    
    setContentType(newType);
    
    // Clear AI results when switching content type
    setSpeechResult(null);
    setMusicResult(null);
    setSourceGains({});
    setSourceBuffers({});
    setError(null);
    
    if (onAICacheUpdate) {
      onAICacheUpdate(null, {}, {}, newType, newType === 'speech' ? 'dprnn' : 'demucs');
    }
  };

  // ===== AI Processing Handlers =====
  
  const handleProcessAudio = async () => {
    if (!audioFile) {
      setError('Please select an audio file first');
      return;
    }

    setAiProcessing(true);
    setError(null);

    try {
      if (contentType === 'speech') {
        const result = await separateSpeechAudio(audioFile, 8);
        setSpeechResult(result);
        setMusicResult(null);
        
        const buffers = await convertSpeechSourcesToBuffers(result);
        const initialGains = initializeGains(Object.keys(result.sources));
        
        setSourceBuffers(buffers);
        setSourceGains(initialGains);
        
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
        if (onAICacheUpdate) {
          onAICacheUpdate(result, initialGains, buffers, 'speech', 'dprnn');
        }
      } else {
        const result = await separateAudio(audioFile, 5.0, 0.1);
        setMusicResult(result);
        setSpeechResult(null);
        
        const buffers = await convertMusicSourcesToBuffers(result);
        const initialGains = initializeGains(Object.keys(result.sources));
        
        setSourceBuffers(buffers);
        setSourceGains(initialGains);
        
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
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

  const handleProcessDemo = async () => {
    setAiProcessing(true);
    setError(null);

    try {
      if (contentType === 'speech') {
        const result = await processSpeechSample(8);
        setSpeechResult(result);
        setMusicResult(null);
        
        const buffers = await convertSpeechSourcesToBuffers(result);
        const initialGains = initializeGains(Object.keys(result.sources));
        
        setSourceBuffers(buffers);
        setSourceGains(initialGains);
        
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
        if (onAICacheUpdate) {
          onAICacheUpdate(result, initialGains, buffers, 'speech', 'dprnn');
        }
      } else {
        const result = await processSampleAudio(5.0, 0.1);
        setMusicResult(result);
        setSpeechResult(null);
        
        const buffers = await convertMusicSourcesToBuffers(result);
        const initialGains = initializeGains(Object.keys(result.sources));
        
        setSourceBuffers(buffers);
        setSourceGains(initialGains);
        
        if (onAudioMixed) {
          const mixed = mixSources(buffers, initialGains, audioContext);
          onAudioMixed(mixed);
        }
        
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

  // ===== Source Control Handlers =====
  
  const handleSourceGainChange = (sourceKey: string, gain: number) => {
    setSourceGains(prev => {
      const updated = { ...prev, [sourceKey]: gain };
      
      // Remix audio immediately
      if ((speechResult || musicResult) && Object.keys(sourceBuffers).length > 0 && onAudioMixed) {
        try {
          const mixed = mixSources(sourceBuffers, updated, audioContext);
          onAudioMixed(mixed);
        } catch (err) {
          console.error('[handleSourceGainChange] Failed to remix:', err);
        }
      }
      
      // Update cache
      if (onAICacheUpdate && (speechResult || musicResult) && Object.keys(sourceBuffers).length > 0) {
        const result = speechResult || musicResult;
        const modelType = speechResult ? 'dprnn' : 'demucs';
        onAICacheUpdate(result!, updated, sourceBuffers, contentType, modelType);
      }
      
      return updated;
    });
  };

  const handlePlayToggle = (sourceKey: string) => {
    const buffer = sourceBuffers[sourceKey];
    if (!buffer) return;
    
    // If same source is playing, stop it
    if (playingSource === sourceKey) {
      stopPlayback();
      return;
    }
    
    // Stop current playback and play new source
    stopPlayback();
    
    const sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    
    const gainNode = audioContext.createGain();
    gainNode.gain.value = sourceGains[sourceKey] ?? 1.0;
    
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

  const handleSoloToggle = (sourceKey: string) => {
    setSoloedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceKey)) {
        next.delete(sourceKey);
      } else {
        next.add(sourceKey);
      }
      return next;
    });
  };

  const handleMuteToggle = (sourceKey: string) => {
    setMutedSources(prev => {
      const next = new Set(prev);
      if (next.has(sourceKey)) {
        next.delete(sourceKey);
      } else {
        next.add(sourceKey);
      }
      return next;
    });
  };

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

  // ===== Utility Functions =====
  
  const initializeGains = (sourceKeys: string[]): Record<string, number> => {
    const gains: Record<string, number> = {};
    sourceKeys.forEach(key => { gains[key] = 1.0; });
    return gains;
  };

  const convertSpeechSourcesToBuffers = async (result: SpeechSeparationResult): Promise<Record<string, AudioBuffer>> => {
    const buffers: Record<string, AudioBuffer> = {};
    
    for (const [sourceKey, sourceData] of Object.entries(result.sources)) {
      const buffer = audioContext.createBuffer(1, sourceData.audio_data.length, result.sample_rate);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < sourceData.audio_data.length; i++) {
        channelData[i] = sourceData.audio_data[i];
      }
      
      buffers[sourceKey] = buffer;
    }
    
    return buffers;
  };

  const convertMusicSourcesToBuffers = async (result: SeparationResult): Promise<Record<string, AudioBuffer>> => {
    const buffers: Record<string, AudioBuffer> = {};
    const sourceNames = ['drums', 'bass', 'vocals', 'other'] as const;
    
    for (const sourceName of sourceNames) {
      const sourceData = result.sources[sourceName];
      if (!sourceData) continue;
      
      const [numChannels, numSamples] = sourceData.audio_shape;
      const buffer = audioContext.createBuffer(numChannels, numSamples, result.sample_rate);
      
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

  const getSourceIds = (): string[] => {
    if (speechResult) return Object.keys(speechResult.sources);
    if (musicResult) return Object.keys(musicResult.sources);
    return [];
  };

  const getSourceLabel = (sourceId: string): string => {
    // Speech sources: source_0, source_1, etc.
    if (sourceId.startsWith('source_')) {
      const index = parseInt(sourceId.split('_')[1]);
      return `Speaker ${index + 1}`; // Convert 0-indexed to 1-indexed for display
    }
    
    // Music sources: drums, bass, vocals, other
    return sourceId.charAt(0).toUpperCase() + sourceId.slice(1);
  };

  const getSpectrogramUrls = (): Record<string, string> => {
    if (musicResult) {
      const urls: Record<string, string> = {};
      Object.entries(musicResult.sources).forEach(([key, data]) => {
        if (data.spectrogram) {
          urls[key] = data.spectrogram;
        }
      });
      return urls;
    }
    return {};
  };

  const getAudioShapes = (): Record<string, string> => {
    const shapes: Record<string, string> = {};
    if (speechResult) {
      Object.entries(speechResult.sources).forEach(([key, data]) => {
        shapes[key] = data.audio_shape.join(' × ');
      });
    } else if (musicResult) {
      Object.entries(musicResult.sources).forEach(([key, data]) => {
        shapes[key] = data.audio_shape.join(' × ');
      });
    }
    return shapes;
  };

  // ===== Render =====
  
  return (
    <div className="customized-mode-panel">
      {/* Mode Toggle */}
      <ModeToggle
        processingMode={processingMode}
        onChange={handleModeSwitch}
        disabled={disabled || aiProcessing}
      />

      {/* Content Type Selector (AI mode only) */}
      {processingMode === 'ai' && (
        <ContentTypeSelector
          contentType={contentType}
          onChange={handleContentTypeChange}
          disabled={disabled || aiProcessing}
        />
      )}

      {/* DSP Controls */}
      {processingMode === 'dsp' && (
        <DSPControls
          onBandSpecsChange={onBandSpecsChange}
          disabled={disabled}
        />
      )}

      {/* AI Controls */}
      {processingMode === 'ai' && (
        <>
          <AIControls
            contentType={contentType}
            audioFile={audioFile}
            onProcess={handleProcessAudio}
            onDemo={handleProcessDemo}
            processing={aiProcessing}
            disabled={disabled}
            hasResults={!!(speechResult || musicResult)}
            cacheInfo={aiCache}
          />

          {/* Source List */}
          {(speechResult || musicResult) && (
            <SourceList
              sourceIds={getSourceIds()}
              getLabel={getSourceLabel}
              sourceGains={sourceGains}
              playingSource={playingSource}
              soloedSources={soloedSources}
              mutedSources={mutedSources}
              onPlayToggle={handlePlayToggle}
              onSoloToggle={handleSoloToggle}
              onMuteToggle={handleMuteToggle}
              onGainChange={handleSourceGainChange}
              spectrogramUrls={getSpectrogramUrls()}
              audioShapes={getAudioShapes()}
              disabled={disabled}
            />
          )}
        </>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
