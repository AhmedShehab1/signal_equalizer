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

Core capabilities include STFT-based equalization, interactive spectrum/spectrogram visualizations, and state-of-the-art AI-based source separation (Hybrid Demucs).

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
- **Visual Feedback:** View generated spectrograms for separated stems directly in the UI.

### 📊 Professional Visualization
- **Dual Linked Viewers:** Synchronized Input/Output waveform visualization.
    - **Shared Pan/Zoom:** Both viewers zoom and pan together for pixel-perfect comparison.
    - **Cursor Sync:** Unified playback position indicator.
- **Spectrograms:** Toggle between frequency spectrum and time-frequency spectrograms with an 80dB dynamic range.

### 🎚️ Playback & Control
- **Variable Speed:** Adjust playback rate from **0.5× to 2×** without pitch artifacts.
- **Accessibility:** Full keyboard navigation and ARIA labeling.

---

## Project Architecture

This project is a **Monorepo** organized as follows:

| Component | Tech Stack | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Handles UI, Web Audio API processing, Canvas visualizations. |
| **Backend** | Python 3.11+, FastAPI, PyTorch | Handles AI inference (Demucs) and heavy computation tasks. |
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
