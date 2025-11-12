"""
Hybrid Demucs Audio Source Separation Service

This module provides audio source separation using the Hybrid Demucs model
from torchaudio. It separates audio into drums, bass, vocals, and other.
"""

import io
import base64
from pathlib import Path
from typing import Dict, Tuple, Optional
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
        total_duration = length / self.sample_rate
        
        chunk_len = int(self.sample_rate * segment * (1 + overlap))
        start = 0
        end = chunk_len
        overlap_frames = overlap * self.sample_rate
        fade = Fade(fade_in_len=0, fade_out_len=int(overlap_frames), fade_shape="linear")
        
        final = torch.zeros(batch, len(self.model.sources), channels, length, device=self.device)
        
        # Calculate total chunks for progress
        total_chunks = 0
        temp_start = 0
        while temp_start < length - overlap_frames:
            total_chunks += 1
            if temp_start == 0:
                temp_start += int(chunk_len - overlap_frames)
            else:
                temp_start += chunk_len
        
        logger.info(f"Processing {total_duration:.1f}s audio in {total_chunks} chunks of {segment}s each")
        
        chunk_num = 0
        while start < length - overlap_frames:
            chunk_num += 1
            chunk = mix[:, :, start:end]
            
            logger.info(f"Processing chunk {chunk_num}/{total_chunks} ({chunk_num/total_chunks*100:.1f}%)")
            
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
        
        logger.info("Source separation completed!")
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
        try:
            # Downsample long audio for spectrogram generation to prevent hanging
            max_duration = 30.0  # Limit to 30 seconds for spectrogram
            if audio.shape[1] > max_duration * self.sample_rate:
                logger.info(f"Downsampling audio from {audio.shape[1]/self.sample_rate:.1f}s to {max_duration:.1f}s for spectrogram")
                # Take first 30 seconds for spectrogram
                audio = audio[:, :int(max_duration * self.sample_rate)]
            
            # Use smaller FFT size for faster computation
            n_fft_spec = 1024  # Reduced from 4096
            hop_length_spec = n_fft_spec // 4
            
            # Create spectrogram transform with optimized parameters
            stft_transform = torchaudio.transforms.Spectrogram(
                n_fft=n_fft_spec,
                hop_length=hop_length_spec,
                power=None,
            )
            
            # Compute spectrogram with optimized parameters
            stft_result = stft_transform(audio)
            magnitude = stft_result.abs()
            spectrogram = 20 * torch.log10(magnitude + 1e-8).cpu().numpy()
            
            # Create figure with optimized size for web display
            fig, axis = plt.subplots(1, 1, figsize=(6, 2.5))  # Even smaller for performance
            
            # Use first channel only and downsample frequency bins for display
            spec_data = spectrogram[0]  # Take first channel
            
            # Downsample frequency bins if too large (every 2nd bin)
            if spec_data.shape[0] > 512:
                spec_data = spec_data[::2, :]
            
            im = axis.imshow(
                spec_data,
                cmap="viridis",
                vmin=-60,
                vmax=0,
                origin="lower",
                aspect="auto"
            )
            axis.set_title(title, fontsize=9)  # Even smaller font
            axis.set_xlabel("Time", fontsize=7)
            axis.set_ylabel("Frequency", fontsize=7)
            
            # Remove tick labels for faster rendering
            axis.set_xticks([])
            axis.set_yticks([])
            
            plt.tight_layout(pad=0.5)  # Tighter layout
            
            # Convert to base64 with very low DPI for web display
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=60, bbox_inches='tight')  # Very low DPI
            plt.close(fig)  # Important: close figure to free memory
            buffer.seek(0)
            
            image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            logger.error(f"Error generating spectrogram: {e}")
            # Close any open figures to prevent memory leaks
            plt.close('all')
            raise e
    
    def process_audio_file(
        self,
        audio_bytes: bytes,
        segment: float = 10.0,
        overlap: float = 0.1,
        generate_spectrograms: bool = True,
        max_duration: Optional[float] = None
    ) -> Dict:
        """
        Process an audio file and separate it into sources.
        
        Args:
            audio_bytes: Raw audio file bytes
            segment: Segment length in seconds for processing
            overlap: Overlap ratio between segments
            generate_spectrograms: Whether to generate spectrogram images
            max_duration: Maximum duration in seconds (truncates if longer)
            
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
        
        # Truncate audio if max_duration is specified
        if max_duration is not None:
            max_frames = int(max_duration * self.sample_rate)
            if waveform.shape[1] > max_frames:
                logger.info(f"Truncating audio from {waveform.shape[1]/self.sample_rate:.1f}s to {max_duration:.1f}s")
                waveform = waveform[:, :max_frames]
        
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
        
        logger.info(f"Converting audio data (generate_spectrograms={generate_spectrograms})...")
        
        # Convert each source to numpy array and optionally generate spectrograms
        for idx, source_name in enumerate(self.model.sources):
            logger.info(f"Processing source: {source_name}")
            source_audio = sources_cpu[idx]
            
            # Convert to numpy for audio data
            audio_numpy = source_audio.numpy()
            
            result["sources"][source_name] = {
                "audio_shape": list(audio_numpy.shape),
                "audio_data": audio_numpy.tolist(),  # For JSON serialization
            }
            
            if generate_spectrograms:
                logger.info(f"Generating spectrogram for {source_name}...")
                try:
                    spectrogram = self.generate_spectrogram_image(
                        source_audio,
                        title=f"Spectrogram - {source_name.capitalize()}"
                    )
                    result["sources"][source_name]["spectrogram"] = spectrogram
                    logger.info(f"Spectrogram for {source_name} completed")
                except Exception as e:
                    logger.error(f"Failed to generate spectrogram for {source_name}: {e}")
                    # Continue without spectrogram for this source
            else:
                logger.info(f"Skipping spectrogram for {source_name} (generate_spectrograms=False)")
        
        # Generate mixture spectrogram
        if generate_spectrograms:
            logger.info("Generating mixture spectrogram...")
            try:
                result["mixture_spectrogram"] = self.generate_spectrogram_image(
                    mixture_cpu,
                    title="Spectrogram - Original Mixture"
                )
                logger.info("Mixture spectrogram completed")
            except Exception as e:
                logger.error(f"Failed to generate mixture spectrogram: {e}")
                # Continue without mixture spectrogram
        else:
            logger.info("Skipping mixture spectrogram (generate_spectrograms=False)")
        
        logger.info("All processing complete!")
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
