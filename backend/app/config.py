"""
Configuration settings for the backend
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000"
    ]
    
    # Application
    DEBUG: bool = True
    LOG_LEVEL: str = "info"
    
    # Audio Processing
    MAX_FILE_SIZE: int = 104857600  # 100MB
    ALLOWED_AUDIO_FORMATS: List[str] = [".wav", ".mp3", ".flac", ".ogg", ".m4a"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
