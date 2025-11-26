"""Numba-accelerated FFT/IFFT implementations used across the backend."""

from __future__ import annotations

from typing import Union

import numba as nb
import numpy as np

ArrayLike = Union[np.ndarray, list, tuple]


def _is_power_of_two(value: int) -> bool:
  """Return True when ``value`` is a positive power of two."""
  return value > 0 and (value & (value - 1)) == 0


@nb.jit(nopython=True, cache=True)
def _fft_fast_impl(x: np.ndarray) -> np.ndarray:
  """Bit-reversal iterative FFT optimized for power-of-two lengths."""
  N = len(x)
  X = x.copy()

  j = 0
  for i in range(1, N):
    bit = N >> 1
    while j >= bit and bit > 0:
      j -= bit
      bit >>= 1
    j += bit
    if i < j:
      temp = X[i]
      X[i] = X[j]
      X[j] = temp

  length = 2
  while length <= N:
    angle = -2j * np.pi / length
    wlen = np.exp(angle)
    for i in range(0, N, length):
      w = 1 + 0j
      half = length // 2
      for j in range(half):
        u = X[i + j]
        v = w * X[i + j + half]
        X[i + j] = u + v
        X[i + j + half] = u - v
        w *= wlen
    length *= 2

  return X


@nb.jit(nopython=True, cache=True)
def _ifft_fast_impl(X: np.ndarray) -> np.ndarray:
  """Inverse FFT via conjugation trick."""
  N = len(X)
  X_conj = np.conj(X)
  x_conj = _fft_fast_impl(X_conj)
  x = np.conj(x_conj) / N
  return x


def fft_fast(x: ArrayLike) -> np.ndarray:
  """Public wrapper accepting any array-like and enforcing power-of-two length."""
  arr = np.asarray(x, dtype=np.complex128)
  if not _is_power_of_two(arr.size):
    raise ValueError("fft_fast requires input length to be a power of two")
  return _fft_fast_impl(arr)


def ifft_fast(X: ArrayLike) -> np.ndarray:
  """Inverse FFT matching :func:`fft_fast`. Returns complex numpy array."""
  arr = np.asarray(X, dtype=np.complex128)
  if not _is_power_of_two(arr.size):
    raise ValueError("ifft_fast requires input length to be a power of two")
  return _ifft_fast_impl(arr)
