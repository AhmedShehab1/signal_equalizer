/**
 * Main application component
 */

import { useState, useEffect, useRef } from 'react';
import FileLoader from './components/FileLoader';
import BandsList from './components/BandsList';
import LinkedWaveformViewers from './components/LinkedWaveformViewers';
import SpectrogramPanel from './components/SpectrogramPanel';
import Controls from './components/Controls';
import ModeSelector from './components/ModeSelector';
import GenericMode, { GenericBand, genericBandsToBandSpecs } from './components/GenericMode';
import CustomizedModePanel from './components/CustomizedModePanel';
import { AudioPlayback } from './lib/playback';
import { stftFrames, istft } from './lib/stft';
import { Complex } from './lib/fft';
import { generateSpectrogram, buildGainVector } from './lib/spectrogram';
import { FrequencyBand, EqualizerMode, PlaybackState, SpectrogramData, BandSpec, STFTOptions } from './model/types';
import './App.css';

type AppMode = 'preset' | 'generic' | 'custom';

function App() {
  // Audio buffers: original (immutable) and processed (EQ output)
  const [originalBuffer, setOriginalBuffer] = useState<AudioBuffer | null>(null);
  const [processedBuffer, setProcessedBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  // Mode switcher
  const [appMode, setAppMode] = useState<AppMode>('preset');
  
  // Preset mode state
  const [bands, setBands] = useState<FrequencyBand[]>([]);
  const [modes, setModes] = useState<EqualizerMode[]>([]);
  const [currentMode, setCurrentMode] = useState<string | null>(null);
  
  // Generic mode state
  const [genericBands, setGenericBands] = useState<GenericBand[]>([]);
  
  // Customized mode state (slider scales for current mode)
  const [customModeBandSpecs, setCustomModeBandSpecs] = useState<BandSpec[]>([]);
  
  // Dual spectrograms: input and output
  const [inputSpectrogramData, setInputSpectrogramData] = useState<SpectrogramData | null>(null);
  const [outputSpectrogramData, setOutputSpectrogramData] = useState<SpectrogramData | null>(null);
  
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

  // Map UI bands → BandSpec (preset mode: dB → linear)
  const presetBandsToBandSpecs = (bs: FrequencyBand[]): BandSpec[] =>
    bs.map(b => ({
      scale: Math.pow(10, b.gain / 20),
      windows: [{ f_start_hz: b.range[0], f_end_hz: b.range[1] }],
    }));

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
      const originalStftFrames = stftFrames(signal, stftOptions);

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
      const outputSamples = istft(modifiedFrames, stftOptions);

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

      // 7. Generate output spectrogram
      const outputSpectrogram = generateSpectrogram(
        Array.from(outputSamples),
        sampleRate
      );

      // Final check before applying state changes
      if (myToken !== recomputeTokenRef.current) {
        console.log('Spectrogram generation cancelled: newer request exists');
        return;
      }

      // Apply state changes only if this is still the current request
      setProcessedBuffer(processedAudioBuffer);
      setOutputSpectrogramData(outputSpectrogram);

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

  // Load modes from JSON files
  useEffect(() => {
    const loadModes = async () => {
      try {
        const modeNames = ['musical', 'animals', 'voices'];
        const loadedModes: EqualizerMode[] = [];

        for (const modeName of modeNames) {
          try {
            const response = await fetch(`/modes/${modeName}.json`);
            if (response.ok) {
              const mode = await response.json();
              loadedModes.push(mode);
            }
          } catch (error) {
            console.warn(`Failed to load ${modeName} mode:`, error);
          }
        }

        setModes(loadedModes);
      } catch (error) {
        console.error('Error loading modes:', error);
      }
    };

    loadModes();
  }, []);

  // Initialize playback and subscribe to time updates
  useEffect(() => {
    const playback = playbackRef.current;
    playback.initialize();

    // Subscribe to playback time updates
    const unsubscribe = playback.subscribe((currentTime) => {
      setPlaybackState(prev => ({
        ...prev,
        currentTime: Math.min(currentTime, prev.duration),
      }));
    });

    return () => {
      unsubscribe();
      playback.dispose();
    };
  }, []);

  const handleFileLoad = async (buffer: AudioBuffer, name: string) => {
    setOriginalBuffer(buffer);
    setProcessedBuffer(null);
    setFileName(name);
    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      duration: buffer.duration,
      playbackRate: 1.0,
    });

    // Initialize default bands for preset mode
    const defaultBands: FrequencyBand[] = [
      { id: '1', label: 'Sub Bass', frequency: 60, gain: 0, range: [20, 100] },
      { id: '2', label: 'Bass', frequency: 150, gain: 0, range: [100, 250] },
      { id: '3', label: 'Low Mid', frequency: 400, gain: 0, range: [250, 500] },
      { id: '4', label: 'Mid', frequency: 1000, gain: 0, range: [500, 2000] },
      { id: '5', label: 'High Mid', frequency: 3000, gain: 0, range: [2000, 4000] },
      { id: '6', label: 'Presence', frequency: 6000, gain: 0, range: [4000, 8000] },
      { id: '7', label: 'Brilliance', frequency: 12000, gain: 0, range: [8000, 20000] },
    ];
    setBands(defaultBands);

    // Initialize default generic bands
    const defaultGenericBands: GenericBand[] = [
      { id: '1', startHz: 20, endHz: 200, scale: 1.0 },
    ];
    setGenericBands(defaultGenericBands);

    // Set up playback with original buffer initially
    playbackRef.current.setBuffer(buffer);
    
    // Reset playback rate to 1.0
    playbackRef.current.setPlaybackRate(1.0);

    // Generate input spectrogram
    const signal = buffer.getChannelData(0);
    const inputSpectrogram = generateSpectrogram(
      Array.from(signal),
      buffer.sampleRate
    );
    setInputSpectrogramData(inputSpectrogram);
    setOutputSpectrogramData(null);

    // Initial processing based on current mode
    if (appMode === 'preset') {
      await runRecompute(presetBandsToBandSpecs(defaultBands));
    } else {
      await runRecompute(genericBandsToBandSpecs(defaultGenericBands));
    }
  };

  const handleBandChange = async (bandId: string, gain: number) => {
    const updatedBands = bands.map(band =>
      band.id === bandId ? { ...band, gain } : band
    );
    setBands(updatedBands);
    await runRecompute(presetBandsToBandSpecs(updatedBands));
  };

  const handleModeSelect = async (modeName: string) => {
    const mode = modes.find(m => m.name === modeName);
    if (!mode) return;

    setCurrentMode(modeName);
    setBands(mode.bands);
    await runRecompute(presetBandsToBandSpecs(mode.bands));
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

  const handleModeSwitch = async (mode: AppMode) => {
    setAppMode(mode);
    
    if (!originalBuffer) return;
    
    // Reprocess with the appropriate mode
    if (mode === 'preset') {
      await runRecompute(presetBandsToBandSpecs(bands));
    } else if (mode === 'generic') {
      await runRecompute(genericBandsToBandSpecs(genericBands));
    } else if (customModeBandSpecs.length > 0) {
      // Only recompute if custom mode has loaded specs
      await runRecompute(customModeBandSpecs);
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

  return (
    <div className="app">
      <h1>Signal Equalizer</h1>
      
      <FileLoader onFileLoad={handleFileLoad} />
      
      {fileName && <p>Loaded: {fileName}</p>}

      {/* Mode switcher */}
      {originalBuffer && (
        <div className="mode-switcher">
          <button
            className={appMode === 'preset' ? 'active' : ''}
            onClick={() => handleModeSwitch('preset')}
            disabled={isProcessing}
          >
            Preset Modes
          </button>
          <button
            className={appMode === 'generic' ? 'active' : ''}
            onClick={() => handleModeSwitch('generic')}
            disabled={isProcessing}
          >
            Generic Mode
          </button>
          <button
            className={appMode === 'custom' ? 'active' : ''}
            onClick={() => handleModeSwitch('custom')}
            disabled={isProcessing}
          >
            Customized Modes
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="processing-indicator">
          <div className="spinner"></div>
          <p>Processing audio...</p>
        </div>
      )}

      {processingError && (
        <div className="error-message">
          <p>Error: {processingError}</p>
        </div>
      )}

      {originalBuffer && (
        <>
          <Controls
            playbackState={playbackState}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSeek={handleSeek}
            onPlaybackRateChange={handlePlaybackRateChange}
          />

          {appMode === 'preset' ? (
            <>
              {modes.length > 0 && (
                <ModeSelector
                  modes={modes}
                  currentMode={currentMode}
                  onModeSelect={handleModeSelect}
                />
              )}

              <BandsList 
                bands={bands} 
                onBandChange={handleBandChange}
                disabled={isProcessing}
              />
            </>
          ) : appMode === 'generic' ? (
            <GenericMode
              onBandsChange={handleGenericBandsChange}
              sampleRate={originalBuffer.sampleRate}
              disabled={isProcessing}
            />
          ) : (
            <CustomizedModePanel
              onBandSpecsChange={handleCustomModeBandSpecsChange}
              disabled={isProcessing}
            />
          )}

          <LinkedWaveformViewers
            inputBuffer={originalBuffer}
            outputBuffer={processedBuffer}
            currentTime={playbackState.currentTime}
          />

          <div className="spectrograms-container">
            <div className="spectrogram-section">
              <h2>Input Spectrogram</h2>
              <SpectrogramPanel spectrogramData={inputSpectrogramData} />
            </div>

            <div className="spectrogram-section">
              <h2>Output Spectrogram (EQ Applied)</h2>
              <SpectrogramPanel spectrogramData={outputSpectrogramData} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
