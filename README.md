# Signal Equalizer

A web-based audio equalizer application with real-time visualization and multiple preset modes.

## Features

- **Audio File Loading**: Load and play various audio formats
- **Real-time Equalization**: Multiple EQ modes with STFT-based processing
- **Equalizer Modes**:
  - **Preset Modes**: Three optimized presets (Musical, Animals, Voices)
  - **Generic Mode**: User-defined frequency subdivisions with linear gain control [0-2x]
  - **Customized Modes**: Advanced multi-window sliders for complex EQ curves (Musical Instruments, Human Voices)
- **Dual Linked Viewers**: Synchronized input/output waveform visualization
  - **Shared Pan/Zoom**: Both viewers zoom and pan together
  - **Time Cursor Sync**: Unified playback position indicator across both waveforms
  - **Reset View**: Quickly return to full waveform display
- **Advanced Playback Controls**: 
  - Play, pause, stop, and seek functionality
  - **Variable Speed**: Adjust playback rate from 0.5× to 2× without pitch change
  - Real-time cursor updates via subscription system
- **Spectrograms**: Input/Output time-frequency analysis
- **Accessibility**: Full keyboard navigation, ARIA labels, and disabled states

## Project Structure

```
/src
  /components
    FileLoader.tsx         # Audio file loading component
    BandsList.tsx          # Equalizer bands control (preset mode)
    GenericMode.tsx        # User-defined band editor
    CustomizedModePanel.tsx # Multi-window slider panel
    LinkedWaveformViewers.tsx # Dual synchronized waveform viewers
    WaveformViewer.tsx     # Individual waveform visualization
    SpectrogramPanel.tsx   # Spectrogram display
    Controls.tsx           # Playback controls with speed selector
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
5. **Playback Controls**: 
   - Play/pause/stop to control audio playback
   - Adjust **playback speed** (0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×) for detailed analysis
   - Seek through the audio timeline
6. **Synchronized Visualization**: 
   - Both input and output waveforms **zoom and pan together**
   - Watch the synchronized **time cursor** move across both viewers
   - Click **Reset View** to return to full waveform display
7. **Spectrograms**: Compare input/output time-frequency representations

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

### Dual Linked Viewers (Phase 5)

- **Architecture**: `LinkedWaveformViewers` wrapper component manages shared state
- **View Range**: Time-based API (seconds) for resolution independence
- **Pan/Zoom Sync**: Single `WaveformViewRange` state controls both viewers
- **Cursor Synchronization**: Subscription-based updates using `requestAnimationFrame`
- **Playback Rate**: Web Audio API's native `sourceNode.playbackRate` for pitch-preserved speed control
- **Performance**: `useCallback`/`useMemo` optimizations to minimize re-renders

### Multi-Window Bands

Customized modes support non-contiguous frequency ranges (e.g., Guitar spanning 82-330, 660-1320, 2640-5280 Hz) controlled by a single slider. See `docs/PHASE4_IMPLEMENTATION.md` for architecture details.

## Testing

```bash
npm test
```

**Test Coverage** (73 passing tests):
- **FFT/IFFT**: Round-trip validation (3 tests)
- **STFT/ISTFT**: WOLA reconstruction (3 tests)
- **Gain Vector**: Multi-window support (2 tests)
- **Generic Mode**: Import/export validation (22 tests)
- **Customized Mode**: Loader and schema validation (16 tests)
- **Playback (Phase 5)**: Subscription system, playback rate control (18 tests)
- **Linked Viewers (Phase 5)**: Shared state, zoom sync, cursor sync (9 tests)

Test audio files are included in `/test_assets` for validating import/export functionality.

## Documentation

See [comparison.md](comparison.md) for a detailed comparison of the equalizer modes and usage recommendations.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.