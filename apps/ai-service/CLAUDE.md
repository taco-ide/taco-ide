# AI Service - Python FastAPI Service

## Overview

This is the **AI service** for TACO-IDE, built with FastAPI and Python. It provides LLM-powered code hints and analysis for students working on programming exercises.

## Purpose

The AI service:
- Generates helpful hints for students (not complete solutions)
- Analyzes student code in context of the exercise
- Provides educational guidance to promote learning
- Calls the backend API for exercise data (no direct database access)

## Tech Stack

- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Dependency Management**: uv
- **LLM Provider**: Anthropic Claude (Sonnet 3.5)
- **HTTP Client**: httpx (for calling backend API)
- **Validation**: Pydantic v2

## Architecture

### Service Communication

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Fastify)                     │
│  ┌────────────────────┐      ┌───────────────────────────┐  │
│  │ POST /v1/ai/chat   │      │ GET /v1/internal/exercises │  │
│  │ (from frontend)    │      │ (for AI service)           │  │
│  └─────────┬──────────┘      └──────────▲────────────────┘  │
└────────────┼────────────────────────────┼───────────────────┘
             │                            │
             │ Calls AI service           │ Fetches data
             ▼                            │
┌─────────────────────────────────────────┼───────────────────┐
│            Python AI Service            │                   │
│  ┌─────────────────────┐    ┌──────────┴─────────────────┐ │
│  │ POST /chat          │    │ backend_api.py             │ │
│  │ - Validates secret  │───▶│ - Calls backend /internal  │ │
│  │ - Gets exercise     │    │ - Returns exercise data    │ │
│  │ - Calls LLM         │    └────────────────────────────┘ │
│  │ - Returns hint      │                                   │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **No Database Access**: AI service calls backend API for all data operations
2. **Service-to-Service Auth**: Uses `X-Internal-Secret` header for authentication
3. **Educational Focus**: Prompts are designed to guide learning, not provide solutions
4. **Stateless**: No session management, each request is independent

## Project Structure

```
apps/ai-service/
├── src/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Environment configuration
│   ├── models/
│   │   ├── chat.py          # ChatRequest, ChatResponse
│   │   └── exercise.py      # Exercise model
│   ├── services/
│   │   ├── backend_api.py   # HTTP client to call backend
│   │   └── llm.py           # Anthropic LLM integration
│   ├── routers/
│   │   └── chat.py          # POST /chat endpoint
│   └── middleware/
│       └── auth.py          # Internal secret validation
├── pyproject.toml           # uv dependencies
├── uv.lock                  # Locked dependencies
├── Dockerfile               # Container build
├── .env.example             # Environment template
└── .env                     # Local environment (not in git)
```

## Quick Start

### Local Development (without Docker)

```bash
# Navigate to AI service directory
cd apps/ai-service

# Copy environment template
cp .env.example .env

# Edit .env and add your Anthropic API key
# ANTHROPIC_API_KEY=sk-ant-...

# Run with uv (hot reload enabled)
uv run uvicorn src.main:app --reload --port 8000
```

### With Docker

```bash
# From monorepo root
cd packages/infra

# Set ANTHROPIC_API_KEY in apps/api/.env.development
# Start all services
npm run services:up

# View AI service logs
npm run ai:logs

# Restart AI service
npm run ai:restart
```

## Environment Variables

Required environment variables (see `.env.example`):

```env
# Backend API Communication
BACKEND_API_URL=http://localhost:3333          # Backend API URL
INTERNAL_API_SECRET=your-secret-here           # Shared secret with backend

# LLM Provider (at least one required)
ANTHROPIC_API_KEY=sk-ant-...                   # Anthropic API key
# OPENAI_API_KEY=sk-...                        # OpenAI API key (future)

# Server Configuration
HOST=0.0.0.0
PORT=8000
```

## API Endpoints

### POST /chat

Generate AI-powered hint for student.

**Authentication**: `X-Internal-Secret` header required

**Request**:
```json
{
  "exercise_id": 1,
  "code": "def add(a, b):\n    pass",
  "language": "python",
  "message": "How do I add two numbers?",
  "user_id": 123
}
```

**Response**:
```json
{
  "response": "Great question! To add two numbers...",
  "suggestions": []
}
```

### GET /health

Health check endpoint (no auth required).

**Response**:
```json
{
  "status": "healthy",
  "service": "ai-service",
  "version": "0.1.0"
}
```

## Adding New Features

### 1. Add a New Endpoint

```python
# src/routers/my_feature.py
from fastapi import APIRouter, Depends
from ..middleware.auth import verify_internal_secret

router = APIRouter(prefix="/my-feature", tags=["my-feature"])

@router.post("", dependencies=[Depends(verify_internal_secret)])
async def my_feature():
    # Implementation
    pass
```

```python
# src/main.py
from .routers import chat, my_feature

app.include_router(chat.router)
app.include_router(my_feature.router)
```

### 2. Add a New Model

```python
# src/models/my_model.py
from pydantic import BaseModel, Field

class MyModel(BaseModel):
    id: int
    name: str = Field(..., description="Name field")
```

### 3. Call Backend API for Data

```python
# In your endpoint
from ..services.backend_api import backend_api

# Fetch exercise
exercise = await backend_api.get_exercise(exercise_id)

# Or add new method to backend_api.py
```

## LLM Configuration

### Current Setup
- **Provider**: Anthropic
- **Model**: claude-3-5-sonnet-20241022
- **Max Tokens**: 1024
- **Temperature**: Default (controlled by Anthropic)

### Customizing Prompts

Edit `src/services/llm.py`:

```python
def _build_system_prompt(self, exercise: Exercise) -> str:
    # Customize system prompt here
    return f"""You are a helpful programming tutor..."""

def _build_user_message(self, code: str, message: str) -> str:
    # Customize user message format
    return f"""STUDENT'S CODE:\n{code}\n\nQUESTION:\n{message}"""
```

## Development Workflow

### Install Dependencies
```bash
uv sync
```

### Run Tests (future)
```bash
uv run pytest
```

### Format Code (future)
```bash
uv run black src/
uv run isort src/
```

### Type Check (future)
```bash
uv run mypy src/
```

## Deployment Considerations

### Production Checklist
- [ ] Set production `ANTHROPIC_API_KEY`
- [ ] Use secure `INTERNAL_API_SECRET` (32+ characters)
- [ ] Configure proper logging (structured JSON logs)
- [ ] Set up health check monitoring
- [ ] Configure resource limits (CPU, memory)
- [ ] Enable HTTPS/TLS
- [ ] Set up rate limiting per user
- [ ] Configure timeout values

### Docker Build
```bash
docker build -t taco-ai-service .
docker run -p 8000:8000 --env-file .env taco-ai-service
```

## Troubleshooting

### AI service won't start
- Check `.env` file exists with all required variables
- Verify `ANTHROPIC_API_KEY` is valid
- Check backend API is running and accessible
- View logs: `npm run ai:logs` or `uv run uvicorn src.main:app --reload`

### Can't connect to backend API
- Verify `BACKEND_API_URL` points to correct host
- Check `INTERNAL_API_SECRET` matches backend configuration
- Ensure backend is running on specified port
- Check network connectivity (Docker network for containers)

### LLM responses are slow
- Normal: First request takes longer (model loading)
- Check Anthropic API status
- Verify network latency
- Consider caching common questions

### Authentication errors
- Verify `X-Internal-Secret` header is sent
- Check secret matches between services
- Ensure backend API is configured with same secret

## Related Documentation

- **Backend API**: `apps/api/CLAUDE.md`
- **Root CLAUDE.md**: Repository overview
- **Anthropic API**: https://docs.anthropic.com/
