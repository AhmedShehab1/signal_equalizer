"""
Base Audio Service with Shared Utilities

This module provides common utilities for audio processing services,
including spectrogram generation, audio loading, and resampling.
"""

import io
import base64
import logging
from pathlib import Path
from typing import Optional, Union, Tuple
from abc import ABC, abstractmethod

import torch
import torchaudio
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server use
import matplotlib.pyplot as plt

logger = logging.getLogger(__name__)


class SpectrogramGenerator:
    """Utility class for generating spectrograms from audio signals"""
    
    @staticmethod
    def generate_spectrogram_image(
        audio: np.ndarray,
        sample_rate: int,
        title: str = "Spectrogram",
        n_fft: int = 1024,
        hop_length: int = 256,
        dpi: int = 60,
        max_duration_seconds: float = 30.0
    ) -> str:
        """
        Generate a spectrogram image as a base64-encoded PNG.
        
        Args:
            audio: Audio signal as numpy array (1D)
            sample_rate: Sample rate of the audio
            title: Title for the spectrogram plot
            n_fft: FFT window size (smaller = faster, less frequency resolution)
            hop_length: Hop length for STFT
            dpi: DPI for the output image (lower = smaller file size)
            max_duration_seconds: Maximum duration to visualize (for performance)
            
        Returns:
            Base64-encoded PNG image string with data URI prefix
        """
        try:
            # Limit audio length for performance
            max_samples = int(max_duration_seconds * sample_rate)
            if len(audio) > max_samples:
                logger.info(f"Limiting spectrogram to {max_duration_seconds}s for performance")
                audio = audio[:max_samples]
            
            # Ensure audio is 1D
            if audio.ndim > 1:
                audio = audio.flatten()
            
            # Pad audio to ensure we have enough samples for at least one FFT window
            if len(audio) < n_fft:
                audio = np.pad(audio, (0, n_fft - len(audio)), mode='constant')
            
            # Compute STFT using librosa-style parameters
            num_frames = 1 + (len(audio) - n_fft) // hop_length
            stft_result = np.zeros((n_fft // 2 + 1, num_frames), dtype=np.complex64)
            
            for frame_idx in range(num_frames):
                start = frame_idx * hop_length
                end = start + n_fft
                if end > len(audio):
                    break
                
                # Apply Hann window
                windowed = audio[start:end] * np.hanning(n_fft)
                # Compute FFT and take positive frequencies only
                fft_result = np.fft.rfft(windowed)
                stft_result[:, frame_idx] = fft_result
            
            # Convert to magnitude
            D = np.abs(stft_result)
            
            # Convert to dB scale
            D_db = 20 * np.log10(np.maximum(D, 1e-10))
            
            # Downsample frequency bins for faster plotting (every 2nd bin)
            D_db = D_db[::2, :]
            
            # Create figure with specified DPI
            fig, ax = plt.subplots(figsize=(10, 4), dpi=dpi)
            
            # Plot spectrogram
            img = ax.imshow(
                D_db,
                aspect='auto',
                origin='lower',
                cmap='viridis',
                interpolation='bilinear',
                extent=[0, num_frames, 0, sample_rate / 2 / 1000]  # Time (frames), Freq (kHz)
            )
            
            ax.set_title(title, fontsize=12)
            ax.set_xlabel('Time (frames)', fontsize=10)
            ax.set_ylabel('Frequency (kHz)', fontsize=10)
            
            # Add colorbar
            cbar = plt.colorbar(img, ax=ax)
            cbar.set_label('Magnitude (dB)', fontsize=10)
            
            plt.tight_layout()
            
            # Convert to base64
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', dpi=dpi)
            plt.close(fig)
            buf.seek(0)
            
            # Encode as base64
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            logger.error(f"Error generating spectrogram: {e}")
            return ""


class BaseAudioService(ABC):
    """
    Abstract base class for audio processing services.
    Provides common functionality like audio loading, resampling, and spectrogram generation.
    """
    
    def __init__(self, sample_rate: int, device: Optional[torch.device] = None):
        """
        Initialize the base audio service.
        
        Args:
            sample_rate: Target sample rate for audio processing
            device: PyTorch device (cuda/cpu), auto-detected if None
        """
        self.sample_rate = sample_rate
        self.device = device or torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.spectrogram_generator = SpectrogramGenerator()
        logger.info(f"Initialized audio service on {self.device}, sample rate: {self.sample_rate} Hz")
    
    def load_audio(
        self,
        audio_input: Union[bytes, Path],
        target_sample_rate: Optional[int] = None,
        max_duration: Optional[float] = None
    ) -> torch.Tensor:
        """
        Load audio from bytes or file path and optionally resample.
        
        Args:
            audio_input: Either bytes object or Path to audio file
            target_sample_rate: Target sample rate (uses self.sample_rate if None)
            max_duration: Maximum duration in seconds (truncates if exceeded)
            
        Returns:
            Waveform tensor [channels, samples] on self.device
        """
        target_sr = target_sample_rate or self.sample_rate
        
        # Load audio based on input type
        if isinstance(audio_input, bytes):
            logger.info(f"Loading audio from bytes ({len(audio_input)} bytes)")
            audio_buffer = io.BytesIO(audio_input)
            waveform, sr = torchaudio.load(audio_buffer)
        else:
            logger.info(f"Loading audio from {audio_input}")
            waveform, sr = torchaudio.load(str(audio_input))
        
        # Resample if needed
        if sr != target_sr:
            logger.info(f"Resampling from {sr} Hz to {target_sr} Hz")
            resampler = torchaudio.transforms.Resample(sr, target_sr)
            waveform = resampler(waveform)
        
        # Move to device
        waveform = waveform.to(self.device)
        
        # Truncate if max_duration is specified
        if max_duration is not None:
            max_frames = int(max_duration * target_sr)
            if waveform.shape[1] > max_frames:
                logger.info(f"Truncating audio from {waveform.shape[1]/target_sr:.1f}s to {max_duration:.1f}s")
                waveform = waveform[:, :max_frames]
        
        return waveform
    
    def prepare_input(
        self,
        waveform: torch.Tensor,
        target_channels: int = 1
    ) -> torch.Tensor:
        """
        Prepare audio input for model processing.
        
        Args:
            waveform: Input waveform tensor [channels, samples]
            target_channels: Target number of channels (1=mono, 2=stereo)
            
        Returns:
            Prepared waveform tensor [channels, samples] (no batch dimension added)
        """
        channels, length = waveform.shape
        
        # Handle channel conversion
        if channels != target_channels:
            if target_channels == 1 and channels > 1:
                # Stereo to mono: average channels
                logger.info(f"Converting {channels} channels to mono by averaging")
                waveform = waveform.mean(dim=0, keepdim=True)
            elif target_channels == 2 and channels == 1:
                # Mono to stereo: duplicate channel
                logger.info("Converting mono to stereo by duplicating channel")
                waveform = waveform.repeat(2, 1)
            else:
                logger.warning(f"Unsupported channel conversion: {channels} -> {target_channels}")
        
        return waveform
    
    def generate_spectrogram(
        self,
        audio: np.ndarray,
        title: str = "Spectrogram",
        n_fft: int = 1024,
        hop_length: int = 256,
        dpi: int = 60,
        max_duration: float = 30.0
    ) -> str:
        """
        Generate spectrogram image using the shared generator.
        
        Args:
            audio: Audio signal as numpy array
            title: Title for the spectrogram
            n_fft: FFT window size
            hop_length: Hop length
            dpi: Output image DPI
            max_duration: Maximum duration to visualize
            
        Returns:
            Base64-encoded PNG image string
        """
        return self.spectrogram_generator.generate_spectrogram_image(
            audio=audio,
            sample_rate=self.sample_rate,
            title=title,
            n_fft=n_fft,
            hop_length=hop_length,
            dpi=dpi,
            max_duration_seconds=max_duration
        )
    
    @abstractmethod
    def separate_sources(self, mix: torch.Tensor, **kwargs) -> torch.Tensor:
        """
        Separate audio sources (must be implemented by subclasses).
        
        Args:
            mix: Input audio tensor
            **kwargs: Additional service-specific parameters
            
        Returns:
            Separated sources tensor
        """
        pass
    
    @abstractmethod
    def process_audio_file(self, audio_path: Path, **kwargs) -> dict:
        """
        Process audio file and return results (must be implemented by subclasses).
        
        Args:
            audio_path: Path to input audio file
            **kwargs: Additional service-specific parameters
            
        Returns:
            Dictionary with processing results
        """
        pass


class AudioChunker:
    """Utility for processing long audio files in chunks with overlap"""
    
    @staticmethod
    def calculate_chunks(
        total_length: int,
        chunk_size: int,
        overlap_frames: int
    ) -> list[Tuple[int, int]]:
        """
        Calculate chunk boundaries for processing long audio.
        
        Args:
            total_length: Total audio length in samples
            chunk_size: Size of each chunk in samples
            overlap_frames: Number of overlapping samples between chunks
            
        Returns:
            List of (start, end) tuples for each chunk
        """
        chunks = []
        start = 0
        
        while start < total_length - overlap_frames:
            end = min(start + chunk_size, total_length)
            chunks.append((start, end))
            
            if end >= total_length:
                break
            
            # Move to next chunk with overlap
            if start == 0:
                start += chunk_size - overlap_frames
            else:
                start += chunk_size
        
        return chunks
    
    @staticmethod
    def blend_chunks(
        chunks: list[torch.Tensor],
        chunk_positions: list[Tuple[int, int]],
        total_length: int,
        overlap_frames: int,
        num_sources: int,
        num_channels: int
    ) -> torch.Tensor:
        """
        Blend overlapping chunks with fade in/out.
        
        Args:
            chunks: List of processed chunk tensors
            chunk_positions: List of (start, end) positions
            total_length: Total output length
            overlap_frames: Overlap size
            num_sources: Number of separated sources
            num_channels: Number of audio channels
            
        Returns:
            Blended output tensor [batch, sources, channels, length]
        """
        from torchaudio.transforms import Fade
        
        output = torch.zeros(1, num_sources, num_channels, total_length)
        fade = Fade(fade_in_len=0, fade_out_len=int(overlap_frames), fade_shape="linear")
        
        for chunk, (start, end) in zip(chunks, chunk_positions):
            # Apply fade to chunk
            faded_chunk = fade(chunk)
            output[:, :, :, start:end] += faded_chunk
        
        return output
