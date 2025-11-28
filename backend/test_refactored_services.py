#!/usr/bin/env python3
"""
Test script to verify both Demucs and DPRNN services work after refactoring.
Tests that the base class inheritance is functioning correctly.
"""

import sys
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_base_audio_service():
    """Test that the base audio service can be imported and instantiated"""
    logger.info("=" * 80)
    logger.info("TEST 1: Base Audio Service Import")
    logger.info("=" * 80)
    
    try:
        from app.services.base_audio_service import (
            SpectrogramGenerator, 
            BaseAudioService, 
            AudioChunker
        )
        logger.info("✅ Successfully imported base audio service classes")
        
        # Test SpectrogramGenerator static methods exist
        if not hasattr(SpectrogramGenerator, 'generate_spectrogram_image'):
            raise AssertionError("SpectrogramGenerator missing generate_spectrogram_image method")
        logger.info("✅ SpectrogramGenerator has generate_spectrogram_image method")
        
        # Test BaseAudioService has required abstract methods
        if not hasattr(BaseAudioService, 'load_audio'):
            raise AssertionError("BaseAudioService missing load_audio method")
        if not hasattr(BaseAudioService, 'prepare_input'):
            raise AssertionError("BaseAudioService missing prepare_input method")
        if not hasattr(BaseAudioService, 'generate_spectrogram'):
            raise AssertionError("BaseAudioService missing generate_spectrogram method")
        logger.info("✅ BaseAudioService has all required methods")
        
        # Test AudioChunker
        if not hasattr(AudioChunker, 'calculate_chunks'):
            raise AssertionError("AudioChunker missing calculate_chunks method")
        logger.info("✅ AudioChunker has chunk calculation methods")
        
        return True
    except Exception as e:
        logger.error(f"❌ Failed to import base service: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_dprnn_service():
    """Test that DPRNN service inherits from base class correctly"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 2: DPRNN Service Inheritance")
    logger.info("=" * 80)
    
    try:
        from app.services.dprnn_service import DPRNNService
        from app.services.base_audio_service import BaseAudioService
        
        logger.info("✅ Successfully imported DPRNNService")
        
        # Check inheritance
        assert issubclass(DPRNNService, BaseAudioService)
        logger.info("✅ DPRNNService inherits from BaseAudioService")
        
        # Try to instantiate
        logger.info("Attempting to instantiate DPRNNService...")
        service = DPRNNService()
        
        # Check it has base class methods
        assert hasattr(service, 'load_audio')
        assert hasattr(service, 'prepare_input')
        assert hasattr(service, 'generate_spectrogram')
        logger.info("✅ DPRNNService has base class methods")
        
        # Check it has DPRNN-specific methods
        assert hasattr(service, 'separate_sources')
        assert hasattr(service, 'process_audio_file')
        logger.info("✅ DPRNNService has DPRNN-specific methods")
        
        # Check device and sample_rate from base class
        assert hasattr(service, 'device')
        assert hasattr(service, 'sample_rate')
        assert service.sample_rate == 8000
        logger.info(f"✅ DPRNNService initialized with device={service.device}, sample_rate={service.sample_rate}")
        
        return True
    except Exception as e:
        logger.error(f"❌ Failed DPRNN service test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_demucs_service():
    """Test that Demucs service inherits from base class correctly"""
    logger.info("\n" + "=" * 80)
    logger.info("TEST 3: Demucs Service Inheritance")
    logger.info("=" * 80)
    
    try:
        from app.services.demucs_service import DemucsService
        from app.services.base_audio_service import BaseAudioService
        
        logger.info("✅ Successfully imported DemucsService")
        
        # Check inheritance
        assert issubclass(DemucsService, BaseAudioService)
        logger.info("✅ DemucsService inherits from BaseAudioService")
        
        # Try to instantiate
        logger.info("Attempting to instantiate DemucsService...")
        service = DemucsService()
        
        # Check it has base class methods
        assert hasattr(service, 'load_audio')
        assert hasattr(service, 'prepare_input')
        assert hasattr(service, 'generate_spectrogram')
        logger.info("✅ DemucsService has base class methods")
        
        # Check it has Demucs-specific methods
        assert hasattr(service, 'separate_sources')
        assert hasattr(service, 'process_audio_file')
        logger.info("✅ DemucsService has Demucs-specific methods")
        
        # Check device and sample_rate from base class
        assert hasattr(service, 'device')
        assert hasattr(service, 'sample_rate')
        assert service.sample_rate == 44100  # Demucs uses 44.1kHz
        logger.info(f"✅ DemucsService initialized with device={service.device}, sample_rate={service.sample_rate}")
        
        return True
    except Exception as e:
        logger.error(f"❌ Failed Demucs service test: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    logger.info("\n" + "=" * 80)
    logger.info("REFACTORED SERVICES TEST SUITE")
    logger.info("=" * 80)
    
    results = []
    
    # Test 1: Base service
    results.append(("Base Audio Service", test_base_audio_service()))
    
    # Test 2: DPRNN service
    results.append(("DPRNN Service", test_dprnn_service()))
    
    # Test 3: Demucs service
    results.append(("Demucs Service", test_demucs_service()))
    
    # Summary
    logger.info("\n" + "=" * 80)
    logger.info("TEST SUMMARY")
    logger.info("=" * 80)
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        logger.info(f"{test_name}: {status}")
        if not passed:
            all_passed = False
    
    logger.info("=" * 80)
    
    if all_passed:
        logger.info("🎉 ALL TESTS PASSED! Refactoring successful!")
        return 0
    else:
        logger.error("⚠️  SOME TESTS FAILED! Please review the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
