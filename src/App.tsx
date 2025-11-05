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
import { generateSpectrogram } from './lib/spectrogram';
import { FrequencyBand, EqualizerMode, PlaybackState, SpectrogramData } from './model/types';
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
    playbackRef.current.applyEqualizer(updatedBands);
  };

  const handleModeSelect = (modeName: string) => {
    const mode = modes.find(m => m.name === modeName);
    if (!mode) return;

    setCurrentMode(modeName);
    setBands(mode.bands);
    playbackRef.current.applyEqualizer(mode.bands);
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
