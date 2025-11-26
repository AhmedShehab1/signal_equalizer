/**
 * Main application component
 */

import { useState, useEffect, useRef } from 'react';
import FileLoader from './components/FileLoader';
import LinkedWaveformViewers from './components/LinkedWaveformViewers';
import TransportBar from './components/TransportBar';
import DualSpectrogram from './components/DualSpectrogram';
import { EQTopBar } from './components/EQTopBar';
import GenericMode, { GenericBand, genericBandsToBandSpecs } from './components/GenericMode';
import CustomizedModePanel from './components/CustomizedModePanel';
import { AudioPlayback } from './lib/playback';
import { stftFrames, istft } from './lib/stft';
import { Complex } from './lib/fft';
import { buildGainVector } from './lib/spectrogram';
import { PlaybackState, BandSpec, STFTOptions } from './model/types';
import { SpeechSeparationResult, SeparationResult } from './lib/api';
import './App.css';

type AppMode = 'generic' | 'custom';
type ContentType = 'music' | 'speech';
type ModelType = 'demucs' | 'dprnn';

// AI separation cache for session persistence
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

function App() {
  // Audio buffers: original (immutable) and processed (EQ output)
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [audioFile, setAudioFile] = useState<File | null>(null); // Track raw file for AI processing
  
  // Mode switcher (only generic and custom modes now)
  const [appMode, setAppMode] = useState<AppMode>('generic');
  
  // Generic mode state
  const [genericBands, setGenericBands] = useState<GenericBand[]>([]);
  
  // Customized mode state (slider scales for current mode)
  const [customModeBandSpecs, setCustomModeBandSpecs] = useState<BandSpec[]>([]);
  
  // AI separation cache - persists across tab switches
  const [aiSeparationCache, setAISeparationCache] = useState<AISeparationCache | null>(null);
  
  // Customized mode sub-tab state (dsp or ai)
  const [customModeTab, setCustomModeTab] = useState<'dsp' | 'ai'>('dsp');
  
  // Spectrogram visibility toggle
  const [showSpectrograms, setShowSpectrograms] = useState<boolean>(true);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    playbackRate: 1.0,
  });

  const playbackRef = useRef<AudioPlayback>(new AudioPlayback());
  const recomputeTokenRef = useRef<number>(0);

  // STFT-domain EQ processing pipeline with race protection
  const recomputeWithSTFTEQ = async (
    buffer: AudioBuffer,
    bandSpecs: BandSpec[]
  ): Promise<void> => {
    // Capture current token and increment for this request
    const myToken = ++recomputeTokenRef.current;
    
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const signal = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;

      const stftOptions: STFTOptions = {
        windowSize: 2048,
        hopSize: 512,
        fftSize: 2048,
      };

      // 1. Compute STFT of original signal
      const originalStftFrames = await stftFrames(signal, stftOptions, sampleRate);

      // Check if still current after async operation
      if (myToken !== recomputeTokenRef.current) {
        console.log('STFT computation cancelled: newer request exists');
        return;
      }

      // 2. Build gain vector from bands
      const gainVector = buildGainVector(bandSpecs, stftOptions.fftSize, sampleRate);

      // 3. Apply gains with Hermitian symmetry
      const fftSize = stftOptions.fftSize;
      const nyquistBin = Math.floor(fftSize / 2);
      const modifiedFrames: Complex[][] = [];

      for (const frame of originalStftFrames) {
        const newFrame: Complex[] = new Array(fftSize);

        // DC bin
        const g0 = gainVector[0];
        newFrame[0] = { re: frame[0].re * g0, im: frame[0].im * g0 };

        // Bins 1..Nyquist-1 with Hermitian mirror
        for (let i = 1; i < nyquistBin; i++) {
          const g = gainVector[i];
          newFrame[i] = { re: frame[i].re * g, im: frame[i].im * g };
          const mirror = fftSize - i;
          newFrame[mirror] = { re: frame[mirror].re * g, im: frame[mirror].im * g };
        }

        // Nyquist bin (fftSize is even)
        if (fftSize % 2 === 0) {
          const gN = gainVector[nyquistBin];
          newFrame[nyquistBin] = {
            re: frame[nyquistBin].re * gN,
            im: frame[nyquistBin].im * gN,
          };
        }

        modifiedFrames.push(newFrame);
      }

      // 4. Inverse STFT
      const outputSamples = await istft(modifiedFrames, stftOptions);

      // Check if still current after heavy ISTFT operation
      if (myToken !== recomputeTokenRef.current) {
        console.log('ISTFT computation cancelled: newer request exists');
        return;
      }

      // 5. Create processed AudioBuffer using shared AudioContext
      const processedAudioBuffer = playbackRef.current.createBuffer(
        1,
        outputSamples.length,
        sampleRate
      );
      
      if (!processedAudioBuffer) {
        throw new Error('Failed to create AudioBuffer');
      }
      
      processedAudioBuffer.getChannelData(0).set(outputSamples);

      // 6. Load into playback
      await playbackRef.current.loadFromFloat32(outputSamples, sampleRate);

      // Check if still current after playback load
      if (myToken !== recomputeTokenRef.current) {
        console.log('Playback load cancelled: newer request exists');
        return;
      }

      // Final check before applying state changes
      if (myToken !== recomputeTokenRef.current) {
        console.log('Spectrum computation cancelled: newer request exists');
        return;
      }

      // Apply state changes only if this is still the current request
      setProcessedBuffer(processedAudioBuffer);

    } catch (error) {
      // Only set error if this is still the current request
      if (myToken === recomputeTokenRef.current) {
        console.error('STFT EQ processing error:', error);
        setProcessingError(error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      // Only clear processing flag if this is still the current request
      if (myToken === recomputeTokenRef.current) {
        setIsProcessing(false);
      }
    }
  };

  // Helper to run recompute with current buffer and bands
  const runRecompute = async (bandSpecs: BandSpec[]): Promise<void> => {
    if (!originalBuffer) {
      console.warn('Cannot recompute: no original buffer loaded');
      return;
    }
    await recomputeWithSTFTEQ(originalBuffer, bandSpecs);
  };

  // Initialize playback and subscribe to time updates
  useEffect(() => {
    const playback = playbackRef.current;
    playback.initialize();

    // Subscribe to playback time updates and reset when the buffer finishes
    const unsubscribe = playback.subscribe((currentTime) => {
      setPlaybackState(prev => {
        const duration = prev.duration || 0;
        const reachedEnd = duration > 0 && currentTime >= duration;

        if (reachedEnd) {
          if (!prev.isPlaying && prev.currentTime === 0) {
            return prev;
          }

          return {
            ...prev,
            isPlaying: false,
            currentTime: 0,
          };
        }

        const clampedTime = duration > 0 ? Math.min(currentTime, duration) : currentTime;
        if (clampedTime === prev.currentTime) {
          return prev;
        }

        return {
          ...prev,
          currentTime: clampedTime,
        };
      });
    });

    return () => {
      unsubscribe();
      playback.dispose();
    };
  }, []);

  const handleFileLoad = async (buffer: AudioBuffer, name: string, file: File) => {
    setOriginalBuffer(buffer);
    setProcessedBuffer(null);
    setFileName(name);
    setAudioFile(file); // Store raw file for AI processing
    
    // Clear AI separation cache when new file is loaded
    setAISeparationCache(null);
    setCustomModeTab('dsp'); // Reset to DSP tab
    
    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      duration: buffer.duration,
      playbackRate: 1.0,
    });

    // Initialize default generic bands
    const defaultGenericBands: GenericBand[] = [
      { id: '1', startHz: 20, endHz: 200, scale: 1.0 },
    ];
    setGenericBands(defaultGenericBands);

    // Set up playback with original buffer initially
    playbackRef.current.setBuffer(buffer);
    
    // Reset playback rate to 1.0
    playbackRef.current.setPlaybackRate(1.0);

    // Initial processing with default bands
    await runRecompute(genericBandsToBandSpecs(defaultGenericBands));
  };

  const handleGenericBandsChange = async (newBands: GenericBand[]) => {
    setGenericBands(newBands);
    await runRecompute(genericBandsToBandSpecs(newBands));
  };

  const handleCustomModeBandSpecsChange = async (bandSpecs: BandSpec[]) => {
    setCustomModeBandSpecs(bandSpecs);
    // Guard against empty specs to avoid redundant recomputes
    if (bandSpecs.length > 0) {
      await runRecompute(bandSpecs);
    }
  };

  const handleAIMixedAudio = async (mixedBuffer: AudioBuffer) => {
    try {
      // Set the mixed audio as the processed buffer for playback
      setProcessedBuffer(mixedBuffer);

      // Update playback to use the new buffer
      playbackRef.current.setBuffer(mixedBuffer);

      // Note: Spectrum chart will update when user triggers DSP recompute
    } catch (error) {
      console.error('Failed to update AI mixed audio', error);
    }
  };

  // Save AI separation results to cache
  const handleAICacheUpdate = (
    result: SpeechSeparationResult | SeparationResult | null,
    sourceGains: Record<string, number>,
    sourceBuffers: Record<string, AudioBuffer>,
    contentType: ContentType,
    modelType: ModelType
  ) => {
    if (result && fileName) {
      setAISeparationCache({
        speechResult: modelType === 'dprnn' ? result as SpeechSeparationResult : null,
        musicResult: modelType === 'demucs' ? result as SeparationResult : null,
        sourceGains,
        sourceBuffers,
        timestamp: Date.now(),
        fileName,
        contentType,
        modelType,
      });
    } else if (!result) {
      // Clear cache when result is null
      setAISeparationCache(null);
    }
  };

  // Handle custom mode tab switching
  const handleCustomModeTabChange = (tab: 'dsp' | 'ai') => {
    setCustomModeTab(tab);
  };

  const handleModeSwitch = async (mode: AppMode) => {
    setAppMode(mode);
    
    if (!originalBuffer) return;
    
    // Reprocess with the appropriate mode
    if (mode === 'generic') {
      await runRecompute(genericBandsToBandSpecs(genericBands));
    } else if (mode === 'custom') {
      // Custom mode: don't recompute automatically
      // Let the user control DSP/AI processing
      if (customModeBandSpecs.length > 0) {
        await runRecompute(customModeBandSpecs);
      }
    }
  };

  const handlePlay = () => {
    playbackRef.current.play();
    setPlaybackState(prev => ({ ...prev, isPlaying: true }));
  };

  const handlePause = () => {
    playbackRef.current.pause();
    setPlaybackState(prev => ({ ...prev, isPlaying: false }));
  };

  const handleStop = () => {
    playbackRef.current.stop();
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
    }));
  };

  const handleSeek = (time: number) => {
    playbackRef.current.seek(time);
    setPlaybackState(prev => ({ ...prev, currentTime: time }));
  };

  const handlePlaybackRateChange = (rate: number) => {
    playbackRef.current.setPlaybackRate(rate);
    setPlaybackState(prev => ({ ...prev, playbackRate: rate }));
  };

  const hasLoadedFile = Boolean(originalBuffer);

  return (
    <div className="eq-app">
      <div className="eq-card">
        {/* Top Bar with Mode Tabs and File Loader */}
        <div className="eq-header">
          <EQTopBar
            mode={appMode}
            onModeChange={handleModeSwitch}
            isProcessing={isProcessing}
          />
          <div className="eq-header__file">
            <FileLoader onFileLoad={handleFileLoad} />
            {fileName && <span className="eq-file-badge">{fileName}</span>}
          </div>
        </div>

        {processingError && (
          <div className="eq-alert eq-alert--error">
            <p>❌ Error: {processingError}</p>
          </div>
        )}

        {/* Main Content Area - Spectrum Prominent at Top */}
        <div className={`eq-content ${!hasLoadedFile ? 'eq-content--empty' : ''}`}>
          {!hasLoadedFile && (
            <div className="eq-empty-state">
              <div className="eq-empty-icon">🎧</div>
              <h3>Welcome to Signal Equalizer</h3>
              <p>Load an audio file to begin shaping your mix.</p>
              <p className="eq-empty-state__hint">Supported formats: WAV, MP3, FLAC</p>
            </div>
          )}

          {hasLoadedFile && (
            <>
              {/* TRANSPORT BAR - Compact inline at top */}
              <section className="eq-transport-section">
                <TransportBar
                  playbackState={playbackState}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onStop={handleStop}
                  onSeek={handleSeek}
                  onPlaybackRateChange={handlePlaybackRateChange}
                  fileName={fileName}
                  isProcessing={isProcessing}
                  compact={true}
                />
              </section>

              {/* DUAL SPECTROGRAM - Input & Output with Toggle - MORE VERTICAL SPACE */}
              <section className="eq-spectrum-section eq-spectrum-section--expanded">
                <DualSpectrogram
                  inputBuffer={originalBuffer}
                  outputBuffer={processedBuffer}
                  visible={showSpectrograms}
                  onVisibilityChange={setShowSpectrograms}
                  height={240}
                />
              </section>

              {/* COMBINED ROW: Waveform Viewers + Controls Side by Side */}
              <section className="eq-combined-row">
                {/* Left: Linked Waveform Viewers */}
                <div className="eq-waveform-compact glass-panel">
                  <LinkedWaveformViewers
                    inputBuffer={originalBuffer}
                    outputBuffer={processedBuffer}
                    currentTime={playbackState.currentTime}
                  />
                </div>

                {/* Right: Mode Controls */}
                <div className="eq-controls-compact glass-panel">
                  {appMode === 'generic' && (
                    <GenericMode
                      onBandsChange={handleGenericBandsChange}
                      sampleRate={originalBuffer!.sampleRate}
                      disabled={isProcessing}
                    />
                  )}

                  {appMode === 'custom' && (
                    <CustomizedModePanel
                      onBandSpecsChange={handleCustomModeBandSpecsChange}
                      disabled={isProcessing}
                      audioFile={audioFile}
                      onAudioMixed={handleAIMixedAudio}
                      aiCache={aiSeparationCache}
                      onAICacheUpdate={handleAICacheUpdate}
                      activeTab={customModeTab}
                      onTabChange={handleCustomModeTabChange}
                    />
                  )}

                  {isProcessing && (
                    <div className="eq-processing-overlay">
                      <div className="eq-processing-spinner" />
                      <span>Processing…</span>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
