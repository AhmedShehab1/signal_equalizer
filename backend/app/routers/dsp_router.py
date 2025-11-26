"""REST endpoints exposing accelerated DSP primitives to the frontend."""

from __future__ import annotations

from typing import List

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.dsp import compute_stft_frames, fft_fast, ifft_fast, inverse_stft

router = APIRouter(prefix="/api/dsp", tags=["dsp"])


class ComplexNumber(BaseModel):
  re: float
  im: float


class FFTRequest(BaseModel):
  signal: List[ComplexNumber]


class FFTResponse(BaseModel):
  spectrum: List[ComplexNumber]


class IFFTRequest(BaseModel):
  spectrum: List[ComplexNumber]


class IFFTResponse(BaseModel):
  signal: List[ComplexNumber]


class STFTOptionsModel(BaseModel):
  window_size: int = Field(2048, ge=2)
  hop_size: int = Field(512, ge=1)
  fft_size: int = Field(2048, ge=2)


class STFTRequest(BaseModel):
  signal: List[float]
  sample_rate: int = Field(44100, ge=1)
  options: STFTOptionsModel = STFTOptionsModel()
  include_frames: bool = False
  include_magnitudes: bool = True


class STFTResponse(BaseModel):
  frames: List[List[ComplexNumber]] | None = None
  magnitudes: List[List[float]] | None = None
  frequencies: List[float] | None = None
  times: List[float] | None = None


class ISTFTRequest(BaseModel):
  frames: List[List[ComplexNumber]]
  options: STFTOptionsModel


class ISTFTResponse(BaseModel):
  signal: List[float]


def _complex_list_to_numpy(items: List[ComplexNumber]) -> np.ndarray:
  return np.array([complex(item.re, item.im) for item in items], dtype=np.complex128)


def _complex_matrix_to_numpy(matrix: List[List[ComplexNumber]]) -> np.ndarray:
  rows = len(matrix)
  cols = len(matrix[0]) if rows else 0
  data = np.zeros((rows, cols), dtype=np.complex128)
  for i, row in enumerate(matrix):
    for j, value in enumerate(row):
      data[i, j] = complex(value.re, value.im)
  return data


def _complex_array_to_list(array: np.ndarray) -> List[ComplexNumber]:
  return [ComplexNumber(re=float(val.real), im=float(val.imag)) for val in array]


def _complex_matrix_to_list(array: np.ndarray) -> List[List[ComplexNumber]]:
  return [[ComplexNumber(re=float(val.real), im=float(val.imag)) for val in row] for row in array]


@router.post("/fft", response_model=FFTResponse)
async def compute_fft_endpoint(payload: FFTRequest) -> FFTResponse:
  try:
    spectrum = fft_fast(_complex_list_to_numpy(payload.signal))
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  return FFTResponse(spectrum=_complex_array_to_list(spectrum))


@router.post("/ifft", response_model=IFFTResponse)
async def compute_ifft_endpoint(payload: IFFTRequest) -> IFFTResponse:
  try:
    signal = ifft_fast(_complex_list_to_numpy(payload.spectrum))
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  return IFFTResponse(signal=_complex_array_to_list(signal))


@router.post("/stft", response_model=STFTResponse)
async def compute_stft_endpoint(payload: STFTRequest) -> STFTResponse:
  opts = payload.options
  try:
    frames = compute_stft_frames(
      np.array(payload.signal, dtype=np.float64),
      window_size=opts.window_size,
      hop_size=opts.hop_size,
      fft_size=opts.fft_size,
    )
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc

  response = STFTResponse()
  if payload.include_frames:
    response.frames = _complex_matrix_to_list(frames)

  if payload.include_magnitudes:
    magnitudes = np.abs(frames[:, : opts.fft_size // 2])
    response.magnitudes = magnitudes.tolist()
    response.frequencies = np.linspace(0, payload.sample_rate / 2, magnitudes.shape[1], endpoint=False).tolist()
    response.times = (
      (np.arange(frames.shape[0]) * opts.hop_size) / float(payload.sample_rate)
    ).tolist()

  return response


@router.post("/istft", response_model=ISTFTResponse)
async def compute_istft_endpoint(payload: ISTFTRequest) -> ISTFTResponse:
  opts = payload.options
  try:
    frames = _complex_matrix_to_numpy(payload.frames)
    signal = inverse_stft(frames, opts.window_size, opts.hop_size)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
  return ISTFTResponse(signal=signal.tolist())
