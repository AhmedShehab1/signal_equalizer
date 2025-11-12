"""
FastAPI Backend for Signal Equalizer
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import logging
from pathlib import Path
from typing import Final

import requests

from app.services.demucs_service import get_demucs_service

ASSETS_DIR: Final[Path] = Path(__file__).resolve().parent.parent / "assets"
SAMPLE_AUDIO_URL: Final[str] = "https://download.pytorch.org/torchaudio/tutorial-assets/hdemucs_mix.wav"
SAMPLE_AUDIO_FILENAME: Final[str] = "hdemucs_mix.wav"

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def ensure_assets_dir() -> Path:
    """Ensure the local assets directory exists."""
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    return ASSETS_DIR

def fetch_sample_audio() -> Path:
    """
    Download the sample audio file if it is not already cached locally.

    Returns:
        Path to the cached sample audio file.
    """
    assets_dir = ensure_assets_dir()
    sample_path = assets_dir / SAMPLE_AUDIO_FILENAME

    if sample_path.exists():
        return sample_path

    response = requests.get(SAMPLE_AUDIO_URL, timeout=60)
    response.raise_for_status()
    sample_path.write_bytes(response.content)
    return sample_path

# Create FastAPI app
app = FastAPI(
    title="Signal Equalizer API",
    description="Backend API for audio equalization processing",
    version="1.0.0",
)

# CORS Configuration
cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:5174,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Signal Equalizer API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "signal-equalizer-backend"
    }


@app.get("/api/info")
async def api_info():
    """API information endpoint"""
    return {
        "name": "Signal Equalizer API",
        "version": "1.0.0",
        "description": "Backend API for audio equalization and AI source separation",
        "endpoints": {
            "root": "/",
            "health": "/health",
            "info": "/api/info",
            "separate": "/api/audio/separate",
            "sample": "/api/audio/sample",
            "docs": "/docs",
            "openapi": "/openapi.json"
        }
    }


@app.post("/api/audio/separate")
async def separate_audio_file(
    file: UploadFile = File(...),
    segment: float = 10.0,
    overlap: float = 0.1
):
    """
    Upload and separate an audio file into sources.
    
    Args:
        file: Audio file to process
        segment: Segment length in seconds for processing (default: 10.0)
        overlap: Overlap ratio between segments (default: 0.1)
        
    Returns:
        JSON with separated sources and spectrograms
    """
    logger.info(f"Received audio separation request for file: {file.filename}")
    
    # Validate file type
    allowed_extensions = {'.wav', '.mp3', '.flac', '.ogg', '.m4a'}
    file_ext = Path(file.filename).suffix.lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Allowed: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Read file contents
        audio_bytes = await file.read()
        
        # Get Demucs service and process
        demucs_service = get_demucs_service()
        result = demucs_service.process_audio_file(
            audio_bytes=audio_bytes,
            segment=segment,
            overlap=overlap,
            generate_spectrograms=True
        )
        
        logger.info("Audio separation completed successfully")
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio: {str(e)}"
        )


@app.get("/api/audio/sample")
async def process_demo_sample(
    segment: float = 5.0,
    overlap: float = 0.1,
    spectrograms: bool = True
):
    """
    Process the built-in demo sample audio for demonstration purposes.
    
    Args:
        segment: Segment length in seconds for processing (default: 5.0)
        overlap: Overlap ratio between segments (default: 0.1)
        spectrograms: Whether to generate spectrograms (default: True)
        
    Returns:
        JSON with separated sources and optionally spectrograms
    """
    logger.info(f"Processing demo sample audio (spectrograms: {spectrograms})")
    
    try:
        # Load sample audio
        sample_path = fetch_sample_audio()
        
        # Read sample file
        with open(sample_path, 'rb') as f:
            audio_bytes = f.read()
        
        # Get Demucs service and process
        demucs_service = get_demucs_service()
        result = demucs_service.process_audio_file(
            audio_bytes,
            segment=segment,
            overlap=overlap,
            generate_spectrograms=spectrograms,
            max_duration=10.0  # Limit to 10 seconds for faster demo
        )
        
        logger.info("Demo sample processing completed successfully")
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Error processing demo sample: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing demo sample: {str(e)}"
        )


# Error handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not Found", "message": "The requested resource was not found"}
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": "Internal Server Error", "message": "An unexpected error occurred"}
    )


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    reload = os.getenv("RELOAD", "true").lower() == "true"
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info",
        timeout_keep_alive=300,  # 5 minutes keep-alive
        timeout_graceful_shutdown=30,
        # Additional settings for long-running AI processing
        backlog=2048,
    )
