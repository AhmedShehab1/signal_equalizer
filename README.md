# Signal Equalizer

A web-based audio equalizer application with real-time visualization and multiple preset modes.

## Features

- **Audio File Loading**: Load and play various audio formats
- **Real-time Equalization**: Multiple EQ modes with STFT-based processing
- **Equalizer Modes**:
  - **Preset Modes**: Three optimized presets (Musical, Animals, Voices)
  - **Generic Mode**: User-defined frequency subdivisions with linear gain control [0-2x]
  - **Customized Modes**: Advanced multi-window sliders for complex EQ curves (Musical Instruments, Human Voices)
- **Dual Visualizations**:
  - Input/Output waveform viewers with playback position indicator
  - Input/Output spectrograms for time-frequency analysis
- **Playback Controls**: Play, pause, stop, and seek functionality
- **Accessibility**: Full keyboard navigation, ARIA labels, and disabled states

## Project Structure

```
/src
  /components
    FileLoader.tsx         # Audio file loading component
    BandsList.tsx          # Equalizer bands control (preset mode)
    GenericMode.tsx        # User-defined band editor
    CustomizedModePanel.tsx # Multi-window slider panel
    WaveformViewer.tsx     # Waveform visualization
    SpectrogramPanel.tsx   # Spectrogram display
    Controls.tsx           # Playback controls
    ModeSelector.tsx       # Preset mode selection
  /lib
    fft.ts                 # Fast Fourier Transform implementation
    stft.ts                # Short-Time Fourier Transform
    playback.ts            # Audio playback engine
    spectrogram.ts         # Spectrogram generation + gain vector
    modes.ts               # Customized mode loader
  /model
    types.ts               # TypeScript type definitions
  App.tsx                  # Main application component
/public
  /modes
    musical.json           # Musical mode preset
    animals.json           # Animals mode preset
    voices.json            # Voices mode preset
    musical_instruments.json # Advanced instrument EQ
    human_voices.json      # Advanced voice EQ
/test_assets
  valid-scheme-test.json   # Valid generic mode schema
  invalid-scheme-test.json # Invalid schema for testing
comparison.md              # Detailed mode comparison
docs/
  PHASE4_IMPLEMENTATION.md # Customized modes implementation details
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
2. **Choose Mode**: 
   - **Preset Modes**: Select Musical, Animals, or Voices
   - **Generic Mode**: Define custom frequency subdivisions (add/delete/adjust bands)
   - **Customized Modes**: Use advanced multi-window sliders for Musical Instruments or Human Voices
3. **Adjust Bands**: Fine-tune frequency bands using the sliders (0-2x linear gain)
4. **Import/Export**: Save and load Generic Mode configurations via JSON
5. **Playback**: Use the play/pause/stop controls to hear the results
6. **Visualize**: Watch input/output waveforms and spectrograms update in real-time

## Technical Details

### Equalizer Implementation

- **Processing Method**: STFT-based frequency domain equalization
- **Filter Type**: Linear gain scaling (0-2x) applied to frequency bins
- **Window**: Hann window for STFT analysis/synthesis
- **Window Size**: 2048 samples
- **Hop Size**: 512 samples (75% overlap)
- **Reconstruction**: Windowed Overlap-Add (WOLA) method
- **Gain Vector**: Product-of-scales rule for overlapping frequency bands

### FFT/STFT

- **Algorithm**: Cooley-Tukey FFT (recursive, radix-2)
- **IFFT**: Conjugation method: `ifft(X) = (1/N) * conj(fft(conj(X)))`
- **Window**: Hann window cached for efficiency
- **Power-of-2 Enforcement**: Automatic zero-padding if needed

### Spectrogram

- **Color Map**: Blue to red intensity mapping
- **Dynamic Range**: 80 dB
- **Frequency Range**: 0 Hz to Nyquist (sample rate / 2)
- **Dual Display**: Input (original) and Output (EQ applied) side-by-side

### Multi-Window Bands

Customized modes support non-contiguous frequency ranges (e.g., Guitar spanning 82-330, 660-1320, 2640-5280 Hz) controlled by a single slider. See `docs/PHASE4_IMPLEMENTATION.md` for architecture details.

## Testing

```bash
npm test
```

**Test Coverage** (46 passing tests):
- FFT/IFFT round-trip (3 tests)
- STFT/ISTFT with WOLA validation (3 tests)
- Gain vector multi-window support (2 tests)
- Generic Mode import/export validation (22 tests)
- Customized Mode loader and schema validation (16 tests)

Test audio files are included in `/test_assets` for validating import/export functionality.

## Documentation

See [comparison.md](comparison.md) for a detailed comparison of the equalizer modes and usage recommendations.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.