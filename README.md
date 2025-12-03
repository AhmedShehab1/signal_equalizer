![Signal Equalizer Banner](docs/images/banner.png)

<div align="center">

# Signal Equalizer

**An elegant, professional audio equalizer and analysis toolkit.**
<br>
Real-time visualizations • Multi-mode equalization • AI-powered source separation

![React](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB?logo=react&style=flat-square)
![Python](https://img.shields.io/badge/backend-FastAPI%20%2B%20Python-3776AB?logo=python&style=flat-square)
![PyTorch](https://img.shields.io/badge/AI-PyTorch%20%2B%20Demucs-EE4C2C?logo=pytorch&style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

[View Demo](#quick-demo) • [Report Bug](../../issues) • [Request Feature](../../issues)

</div>

---

## 📋 Table of Contents
- [Overview](#overview)
- [Quick Demo](#quick-demo)
- [Key Features](#key-features)
- [Project Architecture](#project-architecture)
- [Getting Started](#getting-started)
- [Usage Guide](#usage-guide)
- [Technical Details & DSP](#technical-details--dsp)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License & Contact](#license--contact)

---

## Overview

**Signal Equalizer** is a robust monorepo combining a modern React + TypeScript frontend with a Python FastAPI backend. It is built for audio engineers, researchers, and developers who value transparent DSP implementations and reproducible results.

Core capabilities include STFT-based equalization, interactive spectrum/spectrogram visualizations, and state-of-the-art AI-based source separation (Hybrid Demucs & DPRNN).

---

## Quick Demo

<table>
<tr>
<td align="center"><strong>Real-time Equalization</strong></td>
<td align="center"><strong>AI Source Separation</strong></td>
</tr>
<tr>
<td>

https://github.com/user-attachments/assets/9bb6cda5-86f9-4f22-87ce-630be17a64b1

</td>
<td>

https://github.com/user-attachments/assets/5664f399-5783-4a01-80d7-d879eecaac6d

</td>
</tr>
</table>

---

## Key Features

### 🎛️ Advanced Equalization
- **Preset Modes:** Instant access to optimized presets (Musical, Animals, Voices).
- **Generic Mode:** User-defined frequency subdivisions with linear gain control [0-2x].
- **Customized Modes:** Advanced multi-window sliders for complex EQ curves (e.g., specific instruments spanning non-contiguous frequencies).

### 🎵 AI Source Separation (New)
- **Hybrid Demucs Integration:** Separate full tracks into distinct stems: **Drums**, **Bass**, **Vocals**, and **Other**.
- **Speech Enhancement:** Specialized processing for human speech using **DPRNN**.
- **Visual Feedback:** View generated spectrograms for separated stems directly in the UI.

### 📊 Professional Visualization
- **Dual Linked Viewers:** Synchronized Input/Output waveform visualization.
    - **Shared Pan/Zoom:** Both viewers zoom and pan together for pixel-perfect comparison.
    - **Cursor Sync:** Unified playback position indicator.
- **Spectrograms:** Toggle between frequency spectrum and time-frequency spectrograms with an 80dB dynamic range.
- **Frequency Curve Editor:** Interactive visualization of applied gain curves.

### 🎚️ Playback & Control
- **Variable Speed:** Adjust playback rate from **0.5× to 2×** without pitch artifacts.
- **Accessibility:** Full keyboard navigation and ARIA labeling.
- **Client-Side Mixing:** Real-time audio mixing capabilities in the browser.

---

## Project Architecture

This project is a **Monorepo** organized as follows:

| Component | Tech Stack | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Handles UI, Web Audio API processing, Canvas visualizations. |
| **Backend** | Python 3.11+, FastAPI, PyTorch | Handles AI inference (Demucs, DPRNN) and heavy computation tasks. |
| **Docs** | Markdown | Implementation notes and mathematical theory. |

---

## Getting Started

### Prerequisites
- **Frontend:** Node.js 16+ and npm
- **Backend:** Python 3.11+ (Required only for AI features)

### 1. Frontend Setup (Development)

```bash
cd frontend
npm install
npm run dev
# The app will open at http://localhost:5173
````

### 2\. Backend Setup (Optional - for AI)

```bash
cd backend
python -m venv venv

# Activate Virtual Environment
# Mac/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

pip install -r requirements.txt
python -m app.main
# API docs available at http://localhost:8000/docs
```

### 3\. Production Build

```bash
cd frontend
npm run build
npm run preview
```

-----

## Usage Guide

1.  **Load Audio:** Click the "File Loader" to import common audio formats (MP3, WAV, FLAC).
2.  **Select Mode:**
      * *Preset:* For quick adjustments.
      * *Generic:* For manual band control.
      * *Customized:* For instrument-specific isolation.
3.  **Adjust Audio:** Use sliders to adjust gain (0 to 2x).
4.  **AI Separation:** Navigate to the AI tab to process the track (requires Backend running).
5.  **Analyze:**
      * Use **Linked Viewers** to compare the raw vs. processed waveform.
      * Switch to **Spectrogram View** to see frequency content over time.
      * Change **Playback Speed** to inspect fast transients.

-----

## Technical Details & DSP

### Digital Signal Processing (DSP) Pipeline

The core equalizer uses frequency-domain processing:

  * **Method:** Short-Time Fourier Transform (STFT)
  * **Window Function:** Hann Window
  * **Window Size:** `2048` samples
  * **Hop Size:** `512` samples (75% overlap)
  * **Reconstruction:** Weighted Overlap-Add (WOLA)
  * **FFT Implementation:** Recursive Cooley-Tukey (Radix-2)

### AI Models

  * **Music Separation:** Hybrid Demucs (Facebook Research) for separating Drums, Bass, and Vocals.
  * **Speech Separation:** DPRNN (Dual-Path Recurrent Neural Network) for clean speech extraction.
  * **Framework:** PyTorch & TorchAudio.

### Performance Optimizations

  * **Frontend:** Canvas-based rendering for high-FPS visualization; `useCallback`/`useMemo` to minimize React re-renders.
  * **Backend:** Async endpoints via FastAPI; Modular service architecture.

-----

## Project Structure

```bash
signal_equalizer/
├── frontend/                     # React + TypeScript Client
│   ├── src/
│   │   ├── components/
│   │   │   ├── CustomizedMode/   # NEW: Modular Source Separation UI
│   │   │   │   ├── hooks/        # Logic for mixing & playback
│   │   │   │   ├── styles/       # CSS Modules
│   │   │   │   └── SourceCard.tsx
│   │   │   ├── FrequencyCurveEditor.tsx  # Interactive EQ visualization
│   │   │   ├── SpectrumChart.tsx         # D3/Canvas spectrum analysis
│   │   │   ├── TransportBar.tsx          # Playback controls
│   │   │   └── WorkflowTabs.tsx          # Navigation
│   │   ├── lib/
│   │   │   ├── audioMixer.ts     # NEW: Client-side source mixing logic
│   │   │   ├── api.ts            # Backend API client
│   │   │   └── ...
│   │   └── App.tsx
├── backend/                      # Python FastAPI Server
│   ├── app/
│   │   ├── dsp/                  # NEW: Core DSP Module (FFT/STFT)
│   │   ├── routers/              # API Route definitions
│   │   ├── services/             # Business Logic & AI
│   │   │   ├── demucs_service.py # Hybrid Demucs (Music Separation)
│   │   │   ├── dprnn_service.py  # NEW: DPRNN (Speech Separation)
│   │   │   └── base_audio_service.py
│   │   └── main.py
│   ├── tests/                    # Pytest suite
│   └── requirements.txt
├── dist/                         # Production build artifacts
└── docs/                         # Documentation & Assets
```

-----

## Troubleshooting

  * **Spectrograms appear clipped:** Confirm STFT params (window/hop) match the processing pipeline settings in `stft.ts`.
  * **AI Model Errors:** Ensure you have installed PyTorch with CUDA support if you intend to use a GPU. If on CPU, ensure `requirements.txt` packages are installed correctly.
  * **Audio Glitches:** If using Firefox, ensure `privacy.resistFingerprinting` is disabled as it affects the Web Audio API sample rate.

-----

## Contributing

Contributions are welcome\!

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Run tests:
      * Frontend: `cd frontend && npm test`
      * Backend: `cd backend && pytest`
4.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
5.  Push to the branch.
6.  Open a Pull Request.

-----

## License & Contact

Distributed under the MIT License. See `LICENSE` for more information.

**Maintainer:** Ahmed Shehab
<br>
[](https://www.linkedin.com/in/ahmed-shehab-engineering/)
