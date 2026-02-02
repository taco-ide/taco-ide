"""
Environment configuration using Pydantic Settings.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Internal API Communication
    backend_api_url: str
    internal_api_secret: str

    # LLM Provider (at least one required)
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
