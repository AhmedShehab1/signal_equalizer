"""STFT helpers built on top of the Numba FFT primitives."""

from __future__ import annotations

from typing import Tuple

import numpy as np

from .fft import fft_fast, ifft_fast


def hann_window(window_size: int) -> np.ndarray:
  if window_size <= 1:
    raise ValueError("window_size must be greater than 1")
  indices = np.arange(window_size, dtype=np.float64)
  return 0.5 * (1 - np.cos((2 * np.pi * indices) / (window_size - 1)))


def _validate_fft_params(window_size: int, hop_size: int, fft_size: int) -> None:
  if fft_size < window_size:
    raise ValueError("fft_size must be >= window_size")
  if hop_size <= 0:
    raise ValueError("hop_size must be positive")
  if not np.log2(fft_size).is_integer():
    raise ValueError("fft_size must be a power of two for fft_fast")


def compute_stft_frames(
  signal: np.ndarray,
  window_size: int,
  hop_size: int,
  fft_size: int,
) -> np.ndarray:
  """Return complex STFT frames with Hann analysis window."""
  _validate_fft_params(window_size, hop_size, fft_size)

  samples = np.asarray(signal, dtype=np.float64)
  if samples.ndim != 1:
    samples = samples.flatten()
  if samples.size < window_size:
    raise ValueError("signal must be at least as long as window_size")

  hann = hann_window(window_size)
  num_frames = 1 + (samples.size - window_size) // hop_size
  frames = np.zeros((num_frames, fft_size), dtype=np.complex128)

  for frame_idx in range(num_frames):
    start = frame_idx * hop_size
    segment = samples[start : start + window_size]
    padded = np.zeros(fft_size, dtype=np.complex128)
    padded[:window_size] = segment * hann
    frames[frame_idx] = fft_fast(padded)

  return frames


def inverse_stft(
  frames: np.ndarray,
  window_size: int,
  hop_size: int,
) -> np.ndarray:
  """Reconstruct time-domain signal via Weighted Overlap-Add."""
  if frames.ndim != 2:
    raise ValueError("frames must be a 2D array")
  num_frames, fft_size = frames.shape
  _validate_fft_params(window_size, hop_size, fft_size)

  hann = hann_window(window_size)
  output_length = (num_frames - 1) * hop_size + window_size
  output = np.zeros(output_length, dtype=np.float64)
  window_accum = np.zeros(output_length, dtype=np.float64)

  for frame_idx in range(num_frames):
    time_domain = ifft_fast(frames[frame_idx])
    start = frame_idx * hop_size
    end = start + window_size
    output[start:end] += np.real(time_domain[:window_size])
    window_accum[start:end] += hann

  non_zero = window_accum > 1e-12
  output[non_zero] /= window_accum[non_zero]
  return output


def compute_spectrogram(
  signal: np.ndarray,
  sample_rate: int,
  window_size: int,
  hop_size: int,
  fft_size: int,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
  """Return (magnitudes, frequencies, times)."""
  frames = compute_stft_frames(signal, window_size, hop_size, fft_size)
  magnitudes = np.abs(frames[:, : fft_size // 2])
  times = (np.arange(frames.shape[0]) * hop_size) / float(sample_rate)
  frequencies = np.linspace(0, sample_rate / 2, magnitudes.shape[1], endpoint=False)
  return magnitudes, frequencies, times
