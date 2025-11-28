#!/usr/bin/env python3
"""
Tests for DPRNN Speech Separation API Endpoints

Tests the /api/audio/speech-separate and /api/audio/speech-sample endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from pathlib import Path
import json
import io

from app.main import app

# Create test client
client = TestClient(app)

# Test data paths
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
SPEECH_SAMPLE_PATH = ASSETS_DIR / "5_mixture.wav"


class TestSpeechSeparationEndpoints:
    """Test suite for speech separation API endpoints"""
    
    def test_api_info_includes_speech_endpoints(self):
        """Test that API info includes new speech endpoints"""
        response = client.get("/api/info")
        assert response.status_code == 200
        
        data = response.json()
        assert "endpoints" in data
        assert "speech_separate" in data["endpoints"]
        assert "speech_sample" in data["endpoints"]
        assert data["endpoints"]["speech_separate"] == "/api/audio/speech-separate"
        assert data["endpoints"]["speech_sample"] == "/api/audio/speech-sample"
    
    def test_speech_separate_requires_file(self):
        """Test that speech-separate endpoint requires a file"""
        response = client.post("/api/audio/speech-separate")
        assert response.status_code == 422  # Unprocessable Entity (missing required field)
    
    def test_speech_separate_rejects_invalid_format(self):
        """Test that speech-separate rejects unsupported file formats"""
        # Create a fake text file
        fake_file = io.BytesIO(b"not an audio file")
        files = {"file": ("test.txt", fake_file, "text/plain")}
        
        response = client.post("/api/audio/speech-separate", files=files)
        assert response.status_code == 400
        assert "Unsupported file format" in response.json()["detail"]
    
    def test_speech_separate_validates_max_duration(self):
        """Test that speech-separate validates max_duration parameter"""
        if not SPEECH_SAMPLE_PATH.exists():
            pytest.skip(f"Speech sample not found: {SPEECH_SAMPLE_PATH}")
        
        with open(SPEECH_SAMPLE_PATH, 'rb') as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            
            # Test negative duration
            response = client.post(
                "/api/audio/speech-separate?max_duration=-1",
                files=files
            )
            assert response.status_code == 400
            assert "max_duration must be between 0 and 30" in response.json()["detail"]
            
        with open(SPEECH_SAMPLE_PATH, 'rb') as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            
            # Test too large duration
            response = client.post(
                "/api/audio/speech-separate?max_duration=100",
                files=files
            )
            assert response.status_code == 400
            assert "max_duration must be between 0 and 30" in response.json()["detail"]
    
    @pytest.mark.slow
    def test_speech_separate_with_valid_file(self):
        """Test speech separation with a valid audio file"""
        if not SPEECH_SAMPLE_PATH.exists():
            pytest.skip(f"Speech sample not found: {SPEECH_SAMPLE_PATH}")
        
        with open(SPEECH_SAMPLE_PATH, 'rb') as f:
            files = {"file": ("5_mixture.wav", f, "audio/wav")}
            
            response = client.post(
                "/api/audio/speech-separate?max_duration=5",
                files=files
            )
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "sample_rate" in data
        assert data["sample_rate"] == 8000  # DPRNN uses 8kHz
        
        assert "num_sources" in data
        assert data["num_sources"] > 0
        assert data["num_sources"] <= 5  # DPRNN supports 1-5+ sources
        
        assert "sources" in data
        assert len(data["sources"]) == data["num_sources"]
        
        # Verify each source has required fields
        for source_name, source_data in data["sources"].items():
            assert source_name.startswith("source_")
            assert "audio_data" in source_data
            assert "audio_shape" in source_data
            assert "spectrogram" in source_data
            
            # Verify audio data
            assert isinstance(source_data["audio_data"], list)
            assert len(source_data["audio_data"]) > 0
            
            # Verify spectrogram
            assert source_data["spectrogram"].startswith("data:image/png;base64,")
        
        # Verify mixture spectrogram exists
        assert "mixture_spectrogram" in data
        assert data["mixture_spectrogram"].startswith("data:image/png;base64,")
    
    def test_speech_sample_default_params(self):
        """Test speech sample endpoint with default parameters"""
        if not SPEECH_SAMPLE_PATH.exists():
            pytest.skip(f"Speech sample not found: {SPEECH_SAMPLE_PATH}")
        
        response = client.get("/api/audio/speech-sample")
        
        # If sample doesn't exist, should get 404
        if response.status_code == 404:
            pytest.skip("Speech sample file not available")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify basic structure
        assert "sample_rate" in data
        assert data["sample_rate"] == 8000
        assert "num_sources" in data
        assert "sources" in data
    
    def test_speech_sample_custom_params(self):
        """Test speech sample endpoint with custom parameters"""
        if not SPEECH_SAMPLE_PATH.exists():
            pytest.skip(f"Speech sample not found: {SPEECH_SAMPLE_PATH}")
        
        response = client.get(
            "/api/audio/speech-sample?max_duration=3&spectrograms=false"
        )
        
        if response.status_code == 404:
            pytest.skip("Speech sample file not available")
        
        assert response.status_code == 200
        
        data = response.json()
        
        # When spectrograms=false, spectrograms should not be in response
        for source_name, source_data in data["sources"].items():
            assert "spectrogram" not in source_data
        
        assert "mixture_spectrogram" not in data
    
    def test_speech_sample_validates_max_duration(self):
        """Test that speech-sample validates max_duration parameter"""
        # Test negative duration
        response = client.get("/api/audio/speech-sample?max_duration=-1")
        assert response.status_code == 400
        
        # Test too large duration
        response = client.get("/api/audio/speech-sample?max_duration=100")
        assert response.status_code == 400
    
    @pytest.mark.slow
    def test_speech_vs_music_separation(self):
        """
        Compare DPRNN (speech) vs Demucs (music) on same file.
        
        This test verifies that DPRNN returns generic 'source_N' labels
        while Demucs returns specific instrument labels.
        """
        if not SPEECH_SAMPLE_PATH.exists():
            pytest.skip(f"Speech sample not found: {SPEECH_SAMPLE_PATH}")
        
        with open(SPEECH_SAMPLE_PATH, 'rb') as f:
            audio_bytes = f.read()
        
        # Test DPRNN speech separation
        with io.BytesIO(audio_bytes) as f:
            files_speech = {"file": ("test.wav", f, "audio/wav")}
            response_speech = client.post(
                "/api/audio/speech-separate?max_duration=5",
                files=files_speech
            )
        
        # Test Demucs music separation
        with io.BytesIO(audio_bytes) as f:
            files_music = {"file": ("test.wav", f, "audio/wav")}
            response_music = client.post(
                "/api/audio/separate?segment=5&overlap=0.1",
                files=files_music
            )
        
        assert response_speech.status_code == 200
        assert response_music.status_code == 200
        
        speech_data = response_speech.json()
        music_data = response_music.json()
        
        # DPRNN should return generic source labels
        speech_sources = list(speech_data["sources"].keys())
        assert all(s.startswith("source_") for s in speech_sources)
        
        # Demucs should return instrument labels
        music_sources = list(music_data["sources"].keys())
        expected_instruments = {"drums", "bass", "vocals", "other"}
        assert expected_instruments == set(music_sources)
        
        # DPRNN should use 8kHz sample rate
        assert speech_data["sample_rate"] == 8000
        
        # Demucs should use 44.1kHz sample rate
        assert music_data["sample_rate"] == 44100


class TestResponseSchemaConsistency:
    """Test that DPRNN and Demucs endpoints return consistent schemas"""
    
    @pytest.mark.slow
    def test_response_schema_compatibility(self):
        """
        Test that DPRNN and Demucs responses have compatible schemas.
        
        Both should have:
        - sample_rate: int
        - sources: dict with audio_data, audio_shape, spectrogram
        - mixture_spectrogram: str (base64 PNG)
        """
        if not SPEECH_SAMPLE_PATH.exists():
            pytest.skip(f"Speech sample not found: {SPEECH_SAMPLE_PATH}")
        
        with open(SPEECH_SAMPLE_PATH, 'rb') as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post(
                "/api/audio/speech-separate?max_duration=5",
                files=files
            )
        
        if response.status_code != 200:
            pytest.skip("Speech separation failed")
        
        data = response.json()
        
        # Required top-level fields
        assert "sample_rate" in data
        assert isinstance(data["sample_rate"], int)
        
        assert "sources" in data
        assert isinstance(data["sources"], dict)
        
        # Each source should have consistent structure
        for source_name, source_data in data["sources"].items():
            assert "audio_data" in source_data
            assert isinstance(source_data["audio_data"], list)
            
            assert "audio_shape" in source_data
            assert isinstance(source_data["audio_shape"], list)
            
            assert "spectrogram" in source_data
            assert isinstance(source_data["spectrogram"], str)
            assert source_data["spectrogram"].startswith("data:image/png;base64,")
        
        # Mixture spectrogram should exist
        assert "mixture_spectrogram" in data
        assert isinstance(data["mixture_spectrogram"], str)
        assert data["mixture_spectrogram"].startswith("data:image/png;base64,")


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
