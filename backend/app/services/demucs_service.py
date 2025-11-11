"""
Hybrid Demucs Audio Source Separation Service

This module provides audio source separation using the Hybrid Demucs model
from torchaudio. It separates audio into drums, bass, vocals, and other.
"""

import io
import base64
from pathlib import Path
from typing import Dict, Tuple
import logging

import torch
import torchaudio
from torchaudio.transforms import Fade
from torchaudio.pipelines import HDEMUCS_HIGH_MUSDB_PLUS
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server use
import matplotlib.pyplot as plt
from PIL import Image

logger = logging.getLogger(__name__)


class DemucsService:
    """Service for audio source separation using Hybrid Demucs model"""
    
    def __init__(self):
        """Initialize the Demucs model and device"""
        logger.info("Initializing Hybrid Demucs model...")
        self.bundle = HDEMUCS_HIGH_MUSDB_PLUS
        self.model = self.bundle.get_model()
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.model.to(self.device)
        self.sample_rate = self.bundle.sample_rate
        
        # STFT parameters for spectrogram
        self.n_fft = 4096
        self.n_hop = 4
        self.stft = torchaudio.transforms.Spectrogram(
            n_fft=self.n_fft,
            hop_length=self.n_hop,
            power=None,
        )
        
        logger.info(f"Model initialized on {self.device}, sample rate: {self.sample_rate}")
    
    def separate_sources(
        self,
        mix: torch.Tensor,
        segment: float = 10.0,
        overlap: float = 0.1,
    ) -> torch.Tensor:
        """
        Apply model to a given mixture using fade and segment-by-segment processing.
        
        Args:
            mix: Input audio tensor [batch, channels, length]
            segment: Segment length in seconds
            overlap: Overlap ratio between segments
            
        Returns:
            Separated sources tensor [batch, sources, channels, length]
        """
        batch, channels, length = mix.shape
        
        chunk_len = int(self.sample_rate * segment * (1 + overlap))
        start = 0
        end = chunk_len
        overlap_frames = overlap * self.sample_rate
        fade = Fade(fade_in_len=0, fade_out_len=int(overlap_frames), fade_shape="linear")
        
        final = torch.zeros(batch, len(self.model.sources), channels, length, device=self.device)
        
        while start < length - overlap_frames:
            chunk = mix[:, :, start:end]
            with torch.no_grad():
                out = self.model.forward(chunk)
            out = fade(out)
            final[:, :, :, start:end] += out
            
            if start == 0:
                fade.fade_in_len = int(overlap_frames)
                start += int(chunk_len - overlap_frames)
            else:
                start += chunk_len
            end += chunk_len
            
            if end >= length:
                fade.fade_out_len = 0
        
        return final
    
    def generate_spectrogram_image(self, audio: torch.Tensor, title: str = "Spectrogram") -> str:
        """
        Generate spectrogram image from audio tensor and return as base64 string.
        
        Args:
            audio: Audio tensor [channels, length]
            title: Title for the spectrogram
            
        Returns:
            Base64 encoded PNG image
        """
        # Compute spectrogram
        stft_result = self.stft(audio)
        magnitude = stft_result.abs()
        spectrogram = 20 * torch.log10(magnitude + 1e-8).cpu().numpy()
        
        # Create figure
        fig, axis = plt.subplots(1, 1, figsize=(10, 4))
        im = axis.imshow(
            spectrogram[0],  # Take first channel
            cmap="viridis",
            vmin=-60,
            vmax=0,
            origin="lower",
            aspect="auto"
        )
        axis.set_title(title)
        axis.set_xlabel("Time")
        axis.set_ylabel("Frequency")
        plt.colorbar(im, ax=axis, label="Magnitude (dB)")
        plt.tight_layout()
        
        # Convert to base64
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=100, bbox_inches='tight')
        plt.close(fig)
        buffer.seek(0)
        image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        
        return f"data:image/png;base64,{image_base64}"
    
    def process_audio_file(
        self,
        audio_bytes: bytes,
        segment: float = 10.0,
        overlap: float = 0.1,
        generate_spectrograms: bool = True
    ) -> Dict:
        """
        Process an audio file and separate it into sources.
        
        Args:
            audio_bytes: Raw audio file bytes
            segment: Segment length in seconds for processing
            overlap: Overlap ratio between segments
            generate_spectrograms: Whether to generate spectrogram images
            
        Returns:
            Dictionary containing separated audio and spectrograms
        """
        logger.info("Processing audio file...")
        
        # Load audio from bytes
        audio_buffer = io.BytesIO(audio_bytes)
        waveform, original_sample_rate = torchaudio.load(audio_buffer)
        
        # Resample if necessary
        if original_sample_rate != self.sample_rate:
            logger.info(f"Resampling from {original_sample_rate} to {self.sample_rate}")
            resampler = torchaudio.transforms.Resample(
                orig_freq=original_sample_rate,
                new_freq=self.sample_rate
            )
            waveform = resampler(waveform)
        
        waveform = waveform.to(self.device)
        mixture = waveform
        
        # Normalize
        ref = waveform.mean(0)
        waveform = (waveform - ref.mean()) / ref.std()
        
        # Separate sources
        logger.info("Separating sources...")
        sources = self.separate_sources(
            waveform[None],
            segment=segment,
            overlap=overlap,
        )[0]
        
        # Denormalize
        sources = sources * ref.std() + ref.mean()
        
        # Move to CPU for further processing
        mixture_cpu = mixture.cpu()
        sources_cpu = sources.cpu()
        
        # Prepare result
        result = {
            "sample_rate": self.sample_rate,
            "sources": {}
        }
        
        # Convert each source to numpy array and optionally generate spectrograms
        for idx, source_name in enumerate(self.model.sources):
            source_audio = sources_cpu[idx]
            
            # Convert to numpy for audio data
            audio_numpy = source_audio.numpy()
            
            result["sources"][source_name] = {
                "audio_shape": list(audio_numpy.shape),
                "audio_data": audio_numpy.tolist(),  # For JSON serialization
            }
            
            if generate_spectrograms:
                logger.info(f"Generating spectrogram for {source_name}...")
                spectrogram = self.generate_spectrogram_image(
                    source_audio,
                    title=f"Spectrogram - {source_name.capitalize()}"
                )
                result["sources"][source_name]["spectrogram"] = spectrogram
        
        # Generate mixture spectrogram
        if generate_spectrograms:
            logger.info("Generating mixture spectrogram...")
            result["mixture_spectrogram"] = self.generate_spectrogram_image(
                mixture_cpu,
                title="Spectrogram - Original Mixture"
            )
        
        logger.info("Processing complete!")
        return result
    
    def load_sample_audio(self, sample_path: Path) -> bytes:
        """
        Load a sample audio file for demo purposes.
        
        Args:
            sample_path: Path to the sample audio file
            
        Returns:
            Audio file bytes
        """
        with open(sample_path, 'rb') as f:
            return f.read()


# Global instance (lazy loaded)
_demucs_service = None


def get_demucs_service() -> DemucsService:
    """Get or create the global Demucs service instance"""
    global _demucs_service
    if _demucs_service is None:
        _demucs_service = DemucsService()
    return _demucs_service
