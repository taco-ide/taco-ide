# AI Service - Python FastAPI Service

> **Last updated**: commit `183e61e`

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

Required and optional environment variables (see `.env.example`):

```env
# LLM Provider Configuration (required)
OPENAI_API_KEY=sk-...                          # OpenAI API key (required)

# LLM Configuration (optional, with defaults)
LLM_BASE_URL=https://api.openai.com/v1         # Default: OpenAI API URL
LLM_MODEL=gpt-4o-mini                          # Default: gpt-4o-mini
LLM_MAX_TOKENS=1024                            # Default: 1024
LLM_TEMPERATURE=1.0                            # Default: 1.0

# Server Configuration (optional)
HOST=0.0.0.0                                   # Default: 0.0.0.0
PORT=8000                                      # Default: 8000
```

### LLM Configuration

The service supports any OpenAI-compatible LLM provider by configuring:

- **LLM_BASE_URL**: Base URL for LLM API endpoint (default: OpenAI)
- **LLM_MODEL**: Model name to use (default: gpt-4o-mini)
- **LLM_MAX_TOKENS**: Maximum tokens in response (default: 1024)
- **LLM_TEMPERATURE**: Temperature for response generation (default: 1.0)

#### Examples

**Using Ollama (local model)**:
```env
OPENAI_API_KEY=ollama  # Required but not validated for local endpoints
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=mistral
```

**Using vLLM (local inference server)**:
```env
OPENAI_API_KEY=vllm  # Required but not validated
LLM_BASE_URL=http://localhost:8000/v1
LLM_MODEL=meta-llama/Llama-2-7b-chat-hf
```

**Using Azure OpenAI**:
```env
OPENAI_API_KEY=your-azure-key
LLM_BASE_URL=https://<resource-name>.openai.azure.com/v1
LLM_MODEL=deployment-name
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

Health check endpoint (no auth required). Returns service status and LLM provider information.

**Response**:
```json
{
  "status": "healthy",
  "service": "ai-service",
  "version": "0.2.0",
  "llmModel": "gpt-4o-mini",
  "llmBaseUrl": "https://api.openai.com/v1"
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

All LLM parameters are configurable via environment variables. The service can work with any OpenAI-compatible provider (OpenAI, Ollama, vLLM, Azure OpenAI, LiteLLM, etc.).

### Configuration Parameters

- **OPENAI_API_KEY** (required): API key for the LLM provider
- **LLM_BASE_URL**: Base URL for LLM API (default: `https://api.openai.com/v1`)
- **LLM_MODEL**: Model name to use (default: `gpt-4o-mini`)
- **LLM_MAX_TOKENS**: Max tokens in response (default: `1024`)
- **LLM_TEMPERATURE**: Temperature for sampling (default: `1.0`)

The `LLMService` class reads these values from `settings` and automatically:
1. Initializes the AsyncOpenAI client with the configured `base_url`
2. Uses the configured `model`, `max_tokens`, and `temperature` in API calls
3. Logs provider information at startup

### Customizing Behavior

To customize request/response handling beyond configuration, edit `src/routers/chat.py`:

```python
# src/routers/chat.py
from ..services.llm import llm_service

@router.post("")
async def chat(request: ChatRequest) -> ChatResponse:
    # Build custom prompts here
    system_prompt = f"{request.teaching_assistant.system_prompt}..."
    # Call LLM service
    hint = await llm_service.generate(system_prompt, messages)
    return ChatResponse(response=hint, guardrail_blocked=False)
```

## Development Workflow

### Step 0: Navigate to the AI service directory
```bash
cd apps/ai-service
```

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

## Directory-Specific Documentation

This service has detailed documentation for specific directories:

- **Source Code**: `src/CLAUDE.md` - Detailed source code structure, architecture layers, and patterns
- **Test Suite**: `tests/CLAUDE.md` - Testing conventions, fixtures, and test patterns

## Related Documentation

- **Backend API**: `apps/api/CLAUDE.md`
- **Root CLAUDE.md**: Repository overview
- **OpenAI API**: https://platform.openai.com/docs/

---

## Coding Standards

Standards for writing Python code in this service. All code must follow these conventions.

### Toolchain

| Tool | Purpose | Command |
|------|---------|---------|
| `uv` | Dependency management | `uv sync`, `uv add <pkg>` |
| `ruff` | Linting + formatting | `uv run ruff check src/ tests/` |
| `pyright` | Type checking | `uv run pyright src/` |
| `pytest` | Testing | `uv run pytest` |

#### Required dev dependencies

```toml
# pyproject.toml
[dependency-groups]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.27.0",
    "ruff>=0.4.0",
    "pyright>=1.1.0",
]
```

#### Ruff configuration

```toml
# pyproject.toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.ruff.lint.isort]
known-first-party = ["src"]
```

---

### Code Style

- Python 3.11+ — use modern syntax: `X | Y` unions, `list[str]` generics, `match` when appropriate
- Line length: **100 characters**
- All public functions, methods, and classes must have **docstrings** (Google style)
- Type hints on **all** function signatures

#### Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Class | PascalCase | `GuardrailChain` |
| Function / method | snake_case | `build_system_prompt` |
| Variable | snake_case | `student_code` |
| Constant | UPPER_SNAKE_CASE | `DEFAULT_MODEL` |
| Private | `_` prefix | `_build_messages` |

#### Imports

Order: stdlib → third-party → local. Alphabetise within each group. One blank line between groups.

```python
import os
from abc import ABC, abstractmethod

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..models.chat import ChatRequest
```

---

### Pydantic Models

- All models use `ConfigDict(populate_by_name=True)` so both snake_case and camelCase are accepted
- Use `Field(..., alias="camelCase")` for JSON fields that are camelCase in the API contract
- Never use `Optional[X]` — use `X | None` instead

```python
# src/models/my_model.py
from pydantic import BaseModel, ConfigDict, Field


class MyModel(BaseModel):
    """Brief description of what this model represents."""

    model_config = ConfigDict(populate_by_name=True)

    id: int
    display_name: str = Field(..., alias="displayName", description="Human-readable name")
    optional_field: str | None = Field(default=None, alias="optionalField")
```

Every endpoint must declare a `response_model`. Return the typed model explicitly — do not return bare dicts.

```python
@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    ...
    return ChatResponse(response=hint, suggestions=[])
```

---

### FastAPI Routers

```python
# src/routers/my_feature.py
from fastapi import APIRouter, HTTPException, status

from ..models.my_feature import MyRequest, MyResponse

router = APIRouter(prefix="/my-feature", tags=["my-feature"])


@router.post(
    "",
    response_model=MyResponse,
    summary="Short action summary",
    description="Longer description for Swagger docs",
)
async def my_endpoint(request: MyRequest) -> MyResponse:
    """Handle my feature request."""
    try:
        result = await some_service.do_thing(request)
        return MyResponse(data=result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error. Please try again.",
        ) from e
```

- Always `raise ... from e` to preserve the exception chain
- Re-raise `HTTPException` without wrapping: `except HTTPException: raise`
- Map exceptions to HTTP status codes at the router layer, not in services

---

### Services

Services contain business logic. They are **async classes** instantiated as module-level singletons.

```python
# src/services/my_service.py
"""My service for doing X."""


class MyService:
    """Brief description of the service."""

    def __init__(self, config_value: str) -> None:
        self._config = config_value

    async def do_thing(self, input: str) -> str:
        """Do a thing.

        Args:
            input: The input string to process.

        Returns:
            The processed result.

        Raises:
            ValueError: When input is invalid.
        """
        if not input:
            raise ValueError("Input cannot be empty")
        return input.upper()


# Module-level singleton — import this in routers
my_service = MyService(config_value="default")
```

- Services must not import from `routers` (one-way dependency)
- Services must not raise `HTTPException` — raise domain exceptions instead
- Async methods for all I/O (LLM calls, HTTP requests)

---

### Guardrails

Guardrails follow the **Chain of Responsibility** pattern via `Guardrail` ABC.

```python
# src/guardrails/my_check.py
"""My custom guardrail."""

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class MyCheck(Guardrail):
    """Blocks requests that contain forbidden content."""

    @property
    def name(self) -> str:
        return "my-check"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Check student message for forbidden patterns.

        Returns:
            BLOCK result if forbidden, ALLOW otherwise.
        """
        if "forbidden" in ctx.student_message.lower():
            return GuardrailResult(
                action=GuardrailAction.BLOCK,
                reason="Forbidden content detected",
            )
        return GuardrailResult(action=GuardrailAction.ALLOW)
```

- One guardrail per file, named after what it checks
- `execute` must always return a `GuardrailResult` — never raise
- Guardrails are stateless; all state lives in `GuardrailContext`
- Register new guardrails in `src/guardrails/presets.py`

---

### Configuration

All settings come from environment variables via `pydantic-settings`. No hardcoded values.

- Add new settings to `Settings`, `.env.example`, and document in this file
- Use `model_config` dict style (not inner `class Config`) for Pydantic v2

---

### Error Handling

```python
# Good — specific exception, preserves chain
try:
    result = await llm_service.generate(prompt, messages)
except ValueError as e:
    raise HTTPException(status_code=422, detail=str(e)) from e

# Bad — bare except, swallows context
try:
    result = await llm_service.generate(prompt, messages)
except:
    raise HTTPException(status_code=500, detail="Error")
```

- Use specific exception types — never `except Exception` as a first resort
- Catch broad `Exception` only at the router boundary as a safety net
- Always log the error before re-raising or returning an HTTP error

---

### Testing

#### File layout

```
tests/
├── conftest.py                      # Shared fixtures
├── test_api.py                      # Integration tests (httpx AsyncClient)
├── test_models.py                   # Pydantic model validation
├── test_prompts.py                  # Prompt builder logic
├── test_guardrails_<name>.py        # One file per guardrail area
└── test_<service>.py                # Service unit tests
```

#### Conventions

- `asyncio_mode = "auto"` in `pyproject.toml` — no `@pytest.mark.asyncio` decorator needed
- Test function names: `test_<unit>_<scenario>_<expected_outcome>`
- One assertion per test (or closely related assertions)
- Mock external I/O — never call real OpenAI API in tests

```python
# Good — descriptive name, single concern, mocked I/O
async def test_chat_llm_error_returns_500(async_client):
    with patch("src.routers.chat.llm_service") as mock_llm:
        mock_llm.generate = AsyncMock(side_effect=RuntimeError("OpenAI down"))
        response = await async_client.post("/chat", json=VALID_CHAT_PAYLOAD)

    assert response.status_code == 500
```

#### conftest.py rules

- Set `os.environ["OPENAI_API_KEY"]` **before** any `src.*` imports (prevents module-level init errors)
- Put shared fixtures in `conftest.py`, not repeated per test file
- Use `async_client` fixture (ASGI transport via httpx) for all endpoint tests

---

### Dependency Management

```bash
uv add <package>              # runtime dependency
uv add --group dev <package>  # dev-only dependency
uv sync                       # sync after pulling or pyproject.toml change
uv add <package>@latest       # update a specific package
```

- **Never** manually edit `uv.lock` — let `uv` manage it
- Pin direct dependencies with minimum versions (`>=`), not exact (`==`)

---

### Module Responsibility Rules

- `src/main.py` — app factory only; no business logic
- `src/config.py` — settings only; no logic
- `src/models/` — Pydantic schemas only; no logic
- `src/routers/` — HTTP layer only; delegates to services/prompts
- `src/services/` — stateless async business logic
- `src/prompts/` — prompt construction only
- `src/guardrails/` — guardrail implementations + chain + presets
- `src/middleware/` — FastAPI middleware only

Cross-layer imports are **one-directional**:

```
routers → services / prompts / guardrails / models
services → models / config
guardrails → base types only
models → (nothing internal)
```
