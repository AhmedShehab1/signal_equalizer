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
import { AudioPlayback } from './lib/playback';
import { stftFrames, istft } from './lib/stft';
import { Complex } from './lib/fft';
import { generateSpectrogram, buildGainVector } from './lib/spectrogram';
import { FrequencyBand, EqualizerMode, PlaybackState, SpectrogramData, BandSpec, STFTOptions } from './model/types';
import './App.css';

function App() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [bands, setBands] = useState<FrequencyBand[]>([]);
  const [modes, setModes] = useState<EqualizerMode[]>([]);
  const [currentMode, setCurrentMode] = useState<string | null>(null);
  const [spectrogramData, setSpectrogramData] = useState<SpectrogramData | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });

  const playbackRef = useRef<AudioPlayback>(new AudioPlayback());
  const animationFrameRef = useRef<number>();


    // Map UI bands -> BandSpec (single window per band, dB -> linear scale)
  const toBandSpecs = (bs: FrequencyBand[]): BandSpec[] =>
    bs.map(b => ({
      // gain is assumed dB; change if your UI uses linear scale
      scale: Math.pow(10, b.gain / 20),
      windows: [{ f_start_hz: b.range[0], f_end_hz: b.range[1] }],
    }));

    // Recompute output via STFT-domain EQ and load into the player
  const recomputeWithSTFTEQ = async (
    buffer: AudioBuffer,
    uiBands: FrequencyBand[]
  ) => {
    const signal = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;

    const stftOptions: STFTOptions = {
      windowSize: 2048,
      hopSize: 512,
      fftSize: 2048,
    };

    const originalStftFrames = stftFrames(signal, stftOptions);

    const bandSpecs = toBandSpecs(uiBands);
    const gainVector = buildGainVector(bandSpecs, stftOptions.fftSize, sampleRate);

    const fftSize = stftOptions.fftSize;
    const nyquistBin = Math.floor(fftSize / 2);

    const modifiedFrames: Complex[][] = new Array(originalStftFrames.length);

    for (let f = 0; f < originalStftFrames.length; f++) {
      const frame = originalStftFrames[f];
      const newFrame: Complex[] = frame.slice();

      // 1) DC bin
      const g0 = gainVector[0];
      newFrame[0] = { re: frame[0].re * g0, im: frame[0].im * g0 };

      // 2) 1..Nyquist-1 with Hermitian mirror
      for (let i = 1; i < nyquistBin; i++) {
        const g = gainVector[i];
        newFrame[i] = { re: frame[i].re * g, im: frame[i].im * g };
        const mirror = fftSize - i;
        newFrame[mirror] = { re: frame[mirror].re * g, im: frame[mirror].im * g };
      }

      // 3) Nyquist bin (exists when fftSize is even)
      if (fftSize % 2 === 0) {
        const gN = gainVector[nyquistBin];
        newFrame[nyquistBin] = {
          re: frame[nyquistBin].re * gN,
          im: frame[nyquistBin].im * gN,
        };
      }

      modifiedFrames[f] = newFrame;
    }

    const outputSamples = istft(modifiedFrames, stftOptions);

    // Load back into the player (keeps controls/EQ chain)
    await playbackRef.current.loadFromFloat32(outputSamples, sampleRate);
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

  const handleFileLoad = (buffer: AudioBuffer, name: string) => {
    setAudioBuffer(buffer);
    setFileName(name);
    setPlaybackState({
      isPlaying: false,
      currentTime: 0,
      duration: buffer.duration,
    });

    // Initialize default bands
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

    // Set up playback
    playbackRef.current.setBuffer(buffer);
    playbackRef.current.applyEqualizer(defaultBands);

    // Generate spectrogram
    const signal = buffer.getChannelData(0);
    const spectrogram = generateSpectrogram(
      Array.from(signal),
      buffer.sampleRate
    );
    setSpectrogramData(spectrogram);
  };


  const handleBandChange = (bandId: string, gain: number) => {
    const updatedBands = bands.map(band =>
      band.id === bandId ? { ...band, gain } : band
    );
    setBands(updatedBands);

    // Option A: live Biquad EQ (existing)
    playbackRef.current.applyEqualizer(updatedBands);

    // Option B: STFT-domain processing + reconstruction
    if (audioBuffer) {
      recomputeWithSTFTEQ(audioBuffer, updatedBands).catch(console.error);
    }
  };

  const handleModeSelect = (modeName: string) => {
    const mode = modes.find(m => m.name === modeName);
    if (!mode) return;

    setCurrentMode(modeName);
    setBands(mode.bands);

    // Live EQ
    playbackRef.current.applyEqualizer(mode.bands);

    // STFT-domain processing
    if (audioBuffer) {
      recomputeWithSTFTEQ(audioBuffer, mode.bands).catch(console.error);
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

      {audioBuffer && (
        <>
          <Controls
            playbackState={playbackState}
            onPlay={handlePlay}
            onPause={handlePause}
            onStop={handleStop}
            onSeek={handleSeek}
          />

          {modes.length > 0 && (
            <ModeSelector
              modes={modes}
              currentMode={currentMode}
              onModeSelect={handleModeSelect}
            />
          )}

          <BandsList bands={bands} onBandChange={handleBandChange} />

          <WaveformViewer
            audioBuffer={audioBuffer}
            currentTime={playbackState.currentTime}
          />

          <SpectrogramPanel spectrogramData={spectrogramData} />
        </>
      )}
    </div>
  );
}

export default App;
