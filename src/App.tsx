/**
 * Main application component
 */

import { useState, useEffect, useRef } from 'react';
import FileLoader from './components/FileLoader';
import BandsList from './components/BandsList';
import WaveformViewer from './components/WaveformViewer';
import SpectrogramPanel from './components/SpectrogramPanel';
import Controls from './components/Controls';
import ModeSelector from './components/ModeSelector';
import GenericMode, { GenericBand, genericBandsToBandSpecs } from './components/GenericMode';
import { AudioPlayback } from './lib/playback';
import { stftFrames, istft } from './lib/stft';
import { Complex } from './lib/fft';
import { generateSpectrogram, buildGainVector } from './lib/spectrogram';
import { FrequencyBand, EqualizerMode, PlaybackState, SpectrogramData, BandSpec, STFTOptions } from './model/types';
import './App.css';

type AppMode = 'preset' | 'generic';

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
  });

  const playbackRef = useRef<AudioPlayback>(new AudioPlayback());
  const animationFrameRef = useRef<number>();

  // Map UI bands → BandSpec (preset mode: dB → linear)
  const presetBandsToBandSpecs = (bs: FrequencyBand[]): BandSpec[] =>
    bs.map(b => ({
      scale: Math.pow(10, b.gain / 20),
      windows: [{ f_start_hz: b.range[0], f_end_hz: b.range[1] }],
    }));

  // STFT-domain EQ processing pipeline
  const recomputeWithSTFTEQ = async (
    buffer: AudioBuffer,
    bandSpecs: BandSpec[]
  ): Promise<void> => {
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

      // 5. Create processed AudioBuffer
      const processedAudioBuffer = new AudioContext().createBuffer(
        1,
        outputSamples.length,
        sampleRate
      );
      processedAudioBuffer.getChannelData(0).set(outputSamples);
      setProcessedBuffer(processedAudioBuffer);

      // 6. Load into playback
      await playbackRef.current.loadFromFloat32(outputSamples, sampleRate);

      // 7. Generate output spectrogram
      const outputSpectrogram = generateSpectrogram(
        Array.from(outputSamples),
        sampleRate
      );
      setOutputSpectrogramData(outputSpectrogram);

    } catch (error) {
      console.error('STFT EQ processing error:', error);
      setProcessingError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
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

  // Initialize playback
  useEffect(() => {
    const playback = playbackRef.current;
    playback.initialize();

    return () => {
      playback.dispose();
    };
  }, []);

  // Update playback time
  useEffect(() => {
    const updateTime = () => {
      if (playbackState.isPlaying && playbackRef.current) {
        const currentTime = playbackRef.current.getCurrentTime();
        setPlaybackState(prev => ({
          ...prev,
          currentTime: Math.min(currentTime, prev.duration),
        }));

        if (currentTime < playbackState.duration) {
          animationFrameRef.current = requestAnimationFrame(updateTime);
        } else {
          setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        }
      }
    };

    if (playbackState.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playbackState.isPlaying, playbackState.duration]);

  const handleFileLoad = async (buffer: AudioBuffer, name: string) => {
    setOriginalBuffer(buffer);
    setProcessedBuffer(null);
    setFileName(name);
    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      duration: buffer.duration,
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
      await recomputeWithSTFTEQ(buffer, presetBandsToBandSpecs(defaultBands));
    } else {
      await recomputeWithSTFTEQ(buffer, genericBandsToBandSpecs(defaultGenericBands));
    }
  };

  const handleBandChange = async (bandId: string, gain: number) => {
    const updatedBands = bands.map(band =>
      band.id === bandId ? { ...band, gain } : band
    );
    setBands(updatedBands);

    if (originalBuffer) {
      await recomputeWithSTFTEQ(originalBuffer, presetBandsToBandSpecs(updatedBands));
    }
  };

  const handleModeSelect = async (modeName: string) => {
    const mode = modes.find(m => m.name === modeName);
    if (!mode) return;

    setCurrentMode(modeName);
    setBands(mode.bands);

    if (originalBuffer) {
      await recomputeWithSTFTEQ(originalBuffer, presetBandsToBandSpecs(mode.bands));
    }
  };

  const handleGenericBandsChange = async (newBands: GenericBand[]) => {
    setGenericBands(newBands);

    if (originalBuffer) {
      await recomputeWithSTFTEQ(originalBuffer, genericBandsToBandSpecs(newBands));
    }
  };

  const handleModeSwitch = (mode: AppMode) => {
    setAppMode(mode);
    
    // Reprocess with the appropriate mode
    if (originalBuffer) {
      if (mode === 'preset') {
        recomputeWithSTFTEQ(originalBuffer, presetBandsToBandSpecs(bands));
      } else {
        recomputeWithSTFTEQ(originalBuffer, genericBandsToBandSpecs(genericBands));
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
          ) : (
            <GenericMode
              onBandsChange={handleGenericBandsChange}
              sampleRate={originalBuffer.sampleRate}
              disabled={isProcessing}
            />
          )}

          <div className="viewers-container">
            <div className="viewer-section">
              <h2>Input Signal</h2>
              <WaveformViewer
                audioBuffer={originalBuffer}
                currentTime={playbackState.currentTime}
              />
            </div>

            <div className="viewer-section">
              <h2>Output Signal (EQ Applied)</h2>
              <WaveformViewer
                audioBuffer={processedBuffer}
                currentTime={playbackState.currentTime}
              />
            </div>
          </div>

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
