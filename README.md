# Signal Equalizer

A full-stack audio equalizer application with real-time visualization and multiple preset modes.

## Architecture

This is a monorepo containing:
- **Frontend**: React + TypeScript + Vite web application
- **Backend**: Python FastAPI server for audio processing (ready for future enhancements)

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
signal_equalizer/
├── frontend/                  # React + TypeScript Frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── FileLoader.tsx
│   │   │   ├── BandsList.tsx
│   │   │   ├── GenericMode.tsx
│   │   │   ├── CustomizedModePanel.tsx
│   │   │   ├── LinkedWaveformViewers.tsx
│   │   │   ├── WaveformViewer.tsx
│   │   │   ├── SpectrogramPanel.tsx
│   │   │   ├── Controls.tsx
│   │   │   └── ModeSelector.tsx
│   │   ├── lib/              # Core DSP algorithms
│   │   │   ├── fft.ts        # Fast Fourier Transform
│   │   │   ├── stft.ts       # Short-Time Fourier Transform
│   │   │   ├── playback.ts   # Audio playback engine
│   │   │   ├── spectrogram.ts # Spectrogram generation
│   │   │   └── modes.ts      # Mode management
│   │   ├── model/
│   │   │   └── types.ts      # TypeScript type definitions
│   │   └── App.tsx           # Main application
│   ├── public/
│   │   └── modes/            # EQ mode presets (JSON)
│   ├── package.json
│   └── vite.config.ts
├── backend/                   # Python FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI application
│   │   └── config.py         # Configuration
│   ├── tests/
│   │   └── test_main.py      # API tests
│   ├── requirements.txt      # Python dependencies
│   └── README.md
├── docs/                      # Documentation
│   ├── PHASE4_IMPLEMENTATION.md
│   └── PHASE5_IMPLEMENTATION.md
├── test_assets/               # Test files
└── README.md                  # This file
```

## Technology Stack

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type-safe development
- **Vite**: Build tool and dev server
- **Web Audio API**: Audio processing and playback
- **HTML5 Canvas**: Audio visualizations
- **Vitest**: Testing framework

### Backend
- **Python 3.11+**: Programming language
- **FastAPI**: Modern async web framework
- **Uvicorn**: ASGI server
- **NumPy & SciPy**: Scientific computing
- **Pytest**: Testing framework

## Getting Started

### Prerequisites

- **Frontend**: Node.js 16+ and npm
- **Backend**: Python 3.11+

### Installation & Running

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at `http://localhost:5173`

#### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

Backend API will be available at `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

### Build

#### Frontend Production Build

```bash
cd frontend
npm run build
npm run preview
```

#### Backend Production

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Development

### Frontend Testing

```bash
cd frontend
npm test              # Run tests once
npm run test:watch    # Watch mode
```

### Backend Testing

```bash
cd backend
pytest                           # Run tests
pytest --cov=app tests/         # With coverage
```

### Code Quality

#### Frontend
```bash
cd frontend
npm run lint
```

#### Backend
```bash
cd backend
black app/ tests/     # Format
flake8 app/ tests/    # Lint
mypy app/             # Type check
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

### Frontend Tests
```bash
cd frontend
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

### Backend Tests
```bash
cd backend
pytest
```

Test audio files are included in `/test_assets` for validating import/export functionality.

## Documentation

See [comparison.md](comparison.md) for a detailed comparison of the equalizer modes and usage recommendations.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.