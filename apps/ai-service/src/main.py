"""
AI Service - FastAPI application for LLM-powered code hints.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import chat
from .services.backend_api import backend_api


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    # Startup
    print(f"🚀 AI Service starting on {settings.host}:{settings.port}")
    print(f"📡 Backend API URL: {settings.backend_api_url}")
    print(f"🤖 LLM Provider: {'Anthropic' if settings.anthropic_api_key else 'None'}")

    yield

    # Shutdown
    print("👋 Shutting down AI Service...")
    await backend_api.close()


app = FastAPI(
    title="TACO-IDE AI Service",
    description="LLM-powered code hints and analysis for educational programming platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.backend_api_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat.router)


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "ai-service",
        "version": "0.1.0",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
