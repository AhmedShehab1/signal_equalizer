# Signal Equalizer

A web-based audio equalizer application with real-time visualization and multiple preset modes.

## Features

- **Audio File Loading**: Load and play various audio formats
- **Real-time Equalization**: 7-band parametric equalizer with ±12 dB range
- **Preset Modes**: Three optimized modes for different content types:
  - **Musical**: Enhanced harmonics and clarity for music
  - **Animals**: Optimized for wildlife and nature sounds
  - **Voices**: Improved speech intelligibility
- **Visualizations**:
  - Waveform viewer with playback position indicator
  - Spectrogram display for time-frequency analysis
- **Playback Controls**: Play, pause, stop, and seek functionality

## Project Structure

```
/src
  /components
    FileLoader.tsx         # Audio file loading component
    BandsList.tsx          # Equalizer bands control
    WaveformViewer.tsx     # Waveform visualization
    SpectrogramPanel.tsx   # Spectrogram display
    Controls.tsx           # Playback controls
    ModeSelector.tsx       # Preset mode selection
  /lib
    fft.ts                 # Fast Fourier Transform implementation
    stft.ts                # Short-Time Fourier Transform
    playback.ts            # Audio playback engine
    spectrogram.ts         # Spectrogram generation
  /model
    types.ts               # TypeScript type definitions
  App.tsx                  # Main application component
/public
  /modes
    musical.json           # Musical mode preset
    animals.json           # Animals mode preset
    voices.json            # Voices mode preset
/test_assets
  test_sines.wav           # Test audio file with sine waves
comparison.md              # Detailed mode comparison
```

## Technology Stack

- **React 18**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Build tool and dev server
- **Web Audio API**: Audio processing and playback
- **HTML5 Canvas**: Audio visualizations

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

1. **Load Audio**: Click "Load Audio File" and select an audio file
2. **Choose Mode**: Select a preset mode (Musical, Animals, or Voices)
3. **Adjust Bands**: Fine-tune individual frequency bands using the sliders
4. **Playback**: Use the play/pause/stop controls to hear the results
5. **Visualize**: Watch the waveform and spectrogram update in real-time

## Technical Details

### Equalizer Implementation

- **Filter Type**: Peaking EQ (biquad filters)
- **Bands**: 7 frequency bands from 60 Hz to 12 kHz
- **Q Factor**: 1.0 (moderate bandwidth)
- **Gain Range**: -12 dB to +12 dB

### FFT/STFT

- **Window**: Hamming window
- **Window Size**: 2048 samples
- **Hop Size**: 512 samples
- **Algorithm**: Cooley-Tukey FFT

### Spectrogram

- **Color Map**: Blue to red intensity mapping
- **Dynamic Range**: 80 dB
- **Frequency Range**: 0 Hz to Nyquist (sample rate / 2)

## Testing

A test audio file (`test_sines.wav`) is included with sine waves at 440 Hz, 880 Hz, and 1320 Hz (A4, A5, E6) for testing the equalizer and visualizations.

## Documentation

See [comparison.md](comparison.md) for a detailed comparison of the equalizer modes and usage recommendations.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.