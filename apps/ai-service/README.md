# TACO-IDE AI Service

Stateless LLM-powered code hints for the TACO-IDE educational programming platform.

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- An OpenAI-compatible API key (OpenAI, Ollama, vLLM, etc.)

### Setup

```bash
cp .env.example .env   # then edit with your API key
uv sync
uv run uvicorn src.main:app --reload --port 8000
```

The service will be available at http://localhost:8000

### API Docs

- **Swagger UI**: http://localhost:8000/docs
- **Health check**: http://localhost:8000/health (returns LLM model/provider info)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | API key for the LLM provider | *required* |
| `LLM_BASE_URL` | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `LLM_MODEL` | Model identifier | `gpt-4o-mini` |
| `LLM_MAX_TOKENS` | Max tokens per response | `1024` |
| `LLM_TEMPERATURE` | Sampling temperature | `1.0` |
| `HOST` | Server bind address | `0.0.0.0` |
| `PORT` | Server port | `8000` |

### Using Alternative Providers

Any OpenAI-compatible server works by changing `LLM_BASE_URL`:

```bash
# Ollama (local)
OPENAI_API_KEY=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2

# vLLM (local, GPU)
OPENAI_API_KEY=vllm
LLM_BASE_URL=http://localhost:8001/v1
LLM_MODEL=meta-llama/Llama-3.2-1B-Instruct
```

Docker Compose profiles are also available for Ollama and vLLM — see `packages/infra/docker/compose.yaml`.

## Project Structure

```
src/
├── main.py            # FastAPI app and health endpoint
├── config.py          # Pydantic Settings (env vars)
├── models/
│   ├── chat.py        # ChatRequest/ChatResponse and context models
│   └── health.py      # HealthResponse model
├── routers/
│   └── chat.py        # POST /chat endpoint
├── services/
│   └── llm.py         # AsyncOpenAI wrapper
├── prompts/
│   └── builder.py     # System prompt and message construction
└── guardrails/
    ├── base.py        # Guardrail ABC, context, and result types
    ├── chain.py       # GuardrailChain (before/after LLM)
    ├── presets.py     # Preset factory (loose/medium/strict)
    ├── prompt_injection.py
    ├── prompt_rules.py
    ├── code_detector.py
    ├── pseudocode_detector.py
    ├── token_limit.py
    └── output_length.py
```

## Architecture

This service is **stateless** — it has no database access and no outbound HTTP calls.

The Fastify backend is the sole orchestrator: it gathers exercise data, teaching assistant config, knowledge base, and chat history from the database, then sends a complete payload to this service via `POST /chat`. The AI service builds a prompt, runs guardrails, calls the LLM, and returns a response.

```
Frontend → Backend API → AI Service → LLM Provider
                ↕
            PostgreSQL
```

### Guardrails

Every request passes through a configurable guardrail chain:

- **Before LLM**: prompt injection detection, safety rules injection, token limit validation
- **After LLM**: code block stripping, pseudocode detection, output length truncation

Three presets are available (`loose`, `medium`, `strict`), and teaching assistants can override individual guardrail settings via `guardrailConfig`.

## Testing

```bash
uv run pytest                   # run all tests
uv run pytest -v                # verbose output
uv run pytest tests/test_api.py # single file
```

99 tests covering the API, guardrails, LLM service, models, and prompt builder.

## Docker

```bash
docker build -t taco-ai-service .
docker run -p 8000:8000 --env-file .env taco-ai-service
```

Or via Docker Compose from the repo root:

```bash
cd packages/infra && npm run services:up   # starts PostgreSQL + AI service
```

## Further Reading

See [CLAUDE.md](./CLAUDE.md) for detailed architecture and coding conventions.
