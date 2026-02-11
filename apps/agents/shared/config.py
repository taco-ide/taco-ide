from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5490/taco_dev"
    LLM_API_BASE: str = "http://localhost:8000/v1"
    LLM_MODEL_NAME: str = "my-model"
    LLM_API_KEY: str = "your-key"
    AGENT_PORT: int = 8888
    CODE_EXEC_API_URL: str = "https://emkc.org/api/v2/piston/execute"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
