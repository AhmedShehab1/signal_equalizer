"""
Multi-Decoder DPRNN Speech Source Separation Service

This module provides speech source separation using the Multi-Decoder DPRNN model.
It dynamically separates audio into variable number of speakers (1-5+).
"""

import sys
from pathlib import Path
from typing import Dict, Tuple, Optional
import logging

import torch
import numpy as np

from .base_audio_service import BaseAudioService

logger = logging.getLogger(__name__)


class DPRNNService(BaseAudioService):
    """Service for speech source separation using Multi-Decoder DPRNN model"""
    
    def __init__(self):
        """Initialize the Multi-Decoder DPRNN model and device"""
        # Initialize base class with 8kHz sample rate (model requirement)
        super().__init__(sample_rate=8000)
        
        logger.info("Initializing Multi-Decoder DPRNN model...")
        
        # Add asteroid model path to Python path
        asteroid_path = Path(__file__).parent.parent.parent / "asteroid/egs/wsj0-mix-var/Multi-Decoder-DPRNN"
        if not asteroid_path.exists():
            raise FileNotFoundError(
                f"Asteroid model path not found: {asteroid_path}. "
                "Please run: git clone https://github.com/asteroid-team/asteroid.git"
            )
        
        sys.path.insert(0, str(asteroid_path))
        
        try:
            from model import MultiDecoderDPRNN
            
            # Workaround for PyTorch 2.6+ weights_only security change
            # The model checkpoint was created with PyTorch Lightning < 2.6
            # We trust the Hugging Face JunzheJosephZhu/MultiDecoderDPRNN source
            import warnings
            warnings.filterwarnings('ignore', category=UserWarning)
            
            # Monkey-patch torch.load to use weights_only=False for this trusted checkpoint
            original_load = torch.load
            def patched_load(*args, **kwargs):
                kwargs['weights_only'] = False
                return original_load(*args, **kwargs)
            torch.load = patched_load
            
            self.model = MultiDecoderDPRNN.from_pretrained("JunzheJosephZhu/MultiDecoderDPRNN").eval()
            
            # Restore original torch.load
            torch.load = original_load
            
            # Move model to device (already set in base class)
            self.model.to(self.device)
            
            logger.info(f"Model source: JunzheJosephZhu/MultiDecoderDPRNN (Hugging Face)")
            logger.info(f"Architecture: Multi-Decoder DPRNN (Variable speaker count)")
            
        except Exception as e:
            logger.error(f"Failed to initialize DPRNN model: {e}")
            raise
    
    def separate_sources(
        self,
        mix: torch.Tensor
    ) -> Tuple[torch.Tensor, int]:
        """
        Apply model to separate speech sources.
        
        Args:
            mix: Input audio tensor [batch, channels, length]
            
        Returns:
            Tuple of:
                - Separated sources tensor [num_sources, length]
                - Number of detected sources
        """
        batch, channels, length = mix.shape
        total_duration = length / self.sample_rate
        
        logger.info(f"Processing {total_duration:.1f}s audio for source separation")
        
        # Handle stereo by converting to mono (take first channel)
        if channels > 1:
            logger.info(f"Converting {channels} channels to mono")
            mix = mix[:, 0:1, :]  # Take first channel only
        
        # Move to device
        mix = mix.to(self.device)
        
        # Separate sources
        with torch.no_grad():
            sources_est = self.model.separate(mix).cpu()
        
        num_sources = len(sources_est)
        logger.info(f"Detected {num_sources} source(s)")
        
        return sources_est, num_sources
    
    def process_audio_file(
        self,
        audio_bytes: bytes,
        max_duration: Optional[float] = 10.0,
        generate_spectrograms: bool = True
    ) -> Dict:
        """
        Process an audio file and separate speech sources.
        
        Args:
            audio_bytes: Raw audio file bytes
            max_duration: Maximum duration to process in seconds
            generate_spectrograms: Whether to generate spectrograms
            
        Returns:
            Dictionary with separated sources and metadata
        """
        # Use base class method to load, resample, and truncate audio
        # load_audio() now handles all preprocessing
        waveform = self.load_audio(audio_bytes, max_duration=max_duration)
        
        # Prepare input (convert to mono if stereo)
        waveform = self.prepare_input(waveform, target_channels=1)
        
        # Add batch dimension for model
        if waveform.dim() == 2:
            waveform = waveform.unsqueeze(0)
        
        # Separate sources
        sources_est, num_sources = self.separate_sources(waveform)
        
        # Prepare result dictionary
        result = {
            "sample_rate": self.sample_rate,
            "num_sources": num_sources,
            "sources": {}
        }
        
        # Generate spectrograms if requested
        if generate_spectrograms:
            # Generate spectrogram for original mixture
            mixture_for_spec = waveform[0, 0].cpu().numpy()
            
            result["mixture_spectrogram"] = self.generate_spectrogram(
                mixture_for_spec,
                title="Original Mixture"
            )
        
        # Process each separated source
        for i, source in enumerate(sources_est):
            source_name = f"source_{i}"
            source_np = source.cpu().numpy()
            
            result["sources"][source_name] = {
                "audio_data": source_np.tolist(),
                "audio_shape": list(source_np.shape),
            }
            
            # Generate spectrogram for this source if requested
            if generate_spectrograms:
                result["sources"][source_name]["spectrogram"] = self.generate_spectrogram(
                    source_np,
                    title=f"Source {i}"
                )
        
        logger.info(f"Successfully separated {num_sources} source(s)")
        return result
    
    def __del__(self):
        """Cleanup resources"""
        if hasattr(self, 'model'):
            del self.model
        if torch.cuda.is_available():
            torch.cuda.empty_cache()


# Singleton instance
_dprnn_service_instance: Optional[DPRNNService] = None


def get_dprnn_service() -> DPRNNService:
    """
    Get or create the singleton DPRNN service instance.
    
    Returns:
        DPRNNService instance
    """
    global _dprnn_service_instance
    if _dprnn_service_instance is None:
        _dprnn_service_instance = DPRNNService()
    return _dprnn_service_instance
