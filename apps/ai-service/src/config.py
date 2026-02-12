"""
Environment configuration using Pydantic Settings.

Priority order (highest to lowest):
1. .env file in apps/ai-service/
2. System environment variables
"""

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Get the ai-service root directory (parent of src/)
AI_SERVICE_ROOT = Path(__file__).parent.parent
ENV_FILE = AI_SERVICE_ROOT / ".env"

# Load .env file FIRST with override=True to prioritize .env over system env vars
if ENV_FILE.exists():
    load_dotenv(ENV_FILE, override=True)
    print(f"✓ Loaded environment from: {ENV_FILE}")
else:
    print(f"⚠ No .env file found at: {ENV_FILE}")


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Note: Values are loaded from .env file which takes precedence over
    system environment variables due to load_dotenv(override=True).
    """

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
    )

    # LLM Provider
    openai_api_key: str | None = None
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"
    llm_max_tokens: int = 1024
    llm_temperature: float = 1.0

    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000


# Global settings instance
settings = Settings()
