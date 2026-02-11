"""
AI Service - FastAPI application for LLM-powered code hints.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models.health import HealthResponse
from .routers import chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    print(f"AI Service starting on {settings.host}:{settings.port}")
    print(f"LLM Provider: {'OpenAI' if settings.openai_api_key else 'None'}")
    print(f"LLM Model: {settings.llm_model}")
    print(f"LLM Base URL: {settings.llm_base_url}")
    print(f"LLM Max Tokens: {settings.llm_max_tokens}")
    print(f"LLM Temperature: {settings.llm_temperature}")
    yield
    print("Shutting down AI Service...")


app = FastAPI(
    title="TACO-IDE AI Service",
    description="LLM-powered code hints and analysis for educational programming platform",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)


@app.get("/health", tags=["health"], response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint with LLM provider information."""
    return HealthResponse(
        status="healthy",
        service="ai-service",
        version="0.2.0",
        llm_model=settings.llm_model,
        llm_base_url=settings.llm_base_url,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host=settings.host, port=settings.port, reload=True)
