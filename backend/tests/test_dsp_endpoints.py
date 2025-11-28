"""Tests for the DSP utility endpoints."""

from __future__ import annotations

import math

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _real_to_complex(values):
  return [{"re": float(v), "im": 0.0} for v in values]


def test_fft_ifft_roundtrip():
  signal = [0.0, 1.0, 0.0, -1.0]
  fft_response = client.post("/api/dsp/fft", json={"signal": _real_to_complex(signal)})
  assert fft_response.status_code == 200
  spectrum = fft_response.json()["spectrum"]
  assert len(spectrum) == len(signal)

  ifft_response = client.post("/api/dsp/ifft", json={"spectrum": spectrum})
  assert ifft_response.status_code == 200
  reconstructed = [c["re"] for c in ifft_response.json()["signal"]]
  assert pytest.approx(reconstructed[: len(signal)], rel=1e-6, abs=1e-6) == signal


def test_stft_and_istft():
  window_size = 8
  hop_size = 4
  fft_size = 8
  sample_rate = 32
  signal = [math.sin(2 * math.pi * i / sample_rate) for i in range(32)]

  stft_payload = {
    "signal": signal,
    "sample_rate": sample_rate,
    "options": {
      "window_size": window_size,
      "hop_size": hop_size,
      "fft_size": fft_size,
    },
    "include_frames": True,
    "include_magnitudes": True,
  }
  stft_response = client.post("/api/dsp/stft", json=stft_payload)
  assert stft_response.status_code == 200
  data = stft_response.json()
  assert data["frames"]
  assert data["magnitudes"]
  assert len(data["frequencies"]) == fft_size // 2

  istft_payload = {
    "frames": data["frames"],
    "options": {
      "window_size": window_size,
      "hop_size": hop_size,
      "fft_size": fft_size,
    },
  }
  istft_response = client.post("/api/dsp/istft", json=istft_payload)
  assert istft_response.status_code == 200
  reconstructed = istft_response.json()["signal"]
  assert len(reconstructed) >= len(signal)
