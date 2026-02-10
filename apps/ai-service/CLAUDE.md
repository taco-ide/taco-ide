# AI Service - Python FastAPI Service

## Overview

This is the **AI service** for TACO-IDE, built with FastAPI and Python. It provides LLM-powered code hints and analysis for students working on programming exercises.

## Purpose

The AI service:
- Generates helpful hints for students (not complete solutions)
- Analyzes student code in context of the exercise
- Provides educational guidance to promote learning
- Acts as a stateless LLM wrapper (receives all context in request payload)

## Tech Stack

- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Dependency Management**: uv
- **LLM Provider**: OpenAI GPT (gpt-4o-mini)
- **Validation**: Pydantic v2

## Architecture

### Service Communication (Unidirectional)

```
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Fastify)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ POST /v1/ai/chat                                       │ │
│  │ - Gathers context from database                        │ │
│  │ - Sends complete payload (exercise, TA, KB, history)   │ │
│  └─────────┬──────────────────────────────────────────────┘ │
│            │                                                │
│            │ Sends full context                             │
│            ▼                                                │
└─────────────────────────────────────────────────────────────┘
             │
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│            Python AI Service                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ POST /chat                                              ││
│  │ - Receives complete context in request                  ││
│  │ - Builds system prompt with TA config and knowledge base││
│  │ - Calls OpenAI LLM                                      ││
│  │ - Returns hint response                                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Unidirectional Communication**: Backend API sends all context in single request
2. **Stateless Design**: AI service has no dependencies on backend API or database
3. **No Service-to-Service Auth**: AI service runs on internal network (Docker)
4. **Educational Focus**: Prompts are designed to guide learning, not provide solutions
5. **Multi-turn Conversation**: Supports chat history for contextual hints

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
│   │   └── llm.py           # OpenAI LLM integration
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

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-...

# Run with uv (hot reload enabled)
uv run uvicorn src.main:app --reload --port 8000
```

### With Docker

```bash
# From monorepo root
cd packages/infra

# Set OPENAI_API_KEY in apps/api/.env.development
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
# LLM Provider
OPENAI_API_KEY=sk-...                          # OpenAI API key

# Server Configuration
HOST=0.0.0.0
PORT=8000
```

## API Endpoints

### POST /chat

Generate AI-powered hint for student.

**No authentication required** (runs on internal Docker network)

**Request**:
```json
{
  "code": "def add(a, b):\n    pass",
  "language": "python",
  "message": "How do I add two numbers?",
  "exercise": {
    "title": "Add Two Numbers",
    "description": "Write a function that adds two numbers",
    "supportMaterials": null,
    "possibleSolutions": null
  },
  "teachingAssistant": {
    "systemPrompt": "You are a helpful Python tutor...",
    "targetAudience": "Beginner"
  },
  "knowledgeBase": ["Python documentation on functions..."],
  "chatHistory": [
    { "role": "user", "content": "What is a function?" },
    { "role": "assistant", "content": "A function is..." }
  ]
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
from fastapi import APIRouter

router = APIRouter(prefix="/my-feature", tags=["my-feature"])

@router.post("")
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
from pydantic import BaseModel, ConfigDict, Field

class MyModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: int
    name: str = Field(..., description="Name field")
```

### 3. Update LLM Service

The LLM service is called directly from routers with request data:

```python
# In your endpoint
from ..services.llm import llm_service
from ..models.chat import ChatRequest

hint = await llm_service.generate_hint(request)
```

## LLM Configuration

### Current Setup
- **Provider**: OpenAI
- **Model**: gpt-4o-mini
- **Max Tokens**: 1024
- **Temperature**: Default

### Customizing Prompts

Edit `src/services/llm.py`:

```python
def _build_system_prompt(self, request: ChatRequest) -> str:
    # Customize system prompt here
    ta = request.teaching_assistant
    exercise = request.exercise
    # Build prompt with TA config and exercise context
    return ta.system_prompt + f"\n\nEXERCISE: {exercise.title}"

def _build_messages(self, request: ChatRequest) -> list[dict]:
    # Build messages with chat history and current question
    messages = [...]
    return messages
```

## Development Workflow

### Install Dependencies
```bash
uv sync
```

### Run Tests
```bash
uv run pytest
```

### Lint & Format
```bash
uv run ruff check src/ tests/
uv run ruff format src/ tests/
```

### Type Check
```bash
uv run pyright src/
```

## Deployment Considerations

### Production Checklist
- [ ] Set production `OPENAI_API_KEY`
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
- Verify `OPENAI_API_KEY` is valid
- View logs: `npm run ai:logs` or `uv run uvicorn src.main:app --reload`
- Check Python dependencies: `uv sync`

### Invalid request format
- Verify request JSON matches expected schema with camelCase fields
- Check `teachingAssistant` and `knowledgeBase` are using camelCase
- Ensure all required fields are present in request body

### LLM responses are slow
- Normal: First request takes longer (model loading)
- Check OpenAI API status
- Verify network latency
- Consider caching common questions

### Type validation errors from Pydantic
- Ensure field names match aliases (accept both snake_case and camelCase)
- Check ConfigDict has `populate_by_name=True`
- Verify Field definitions have proper aliases

## Related Documentation

- **Backend API**: `apps/api/CLAUDE.md`
- **Root CLAUDE.md**: Repository overview
- **OpenAI API**: https://platform.openai.com/docs/
