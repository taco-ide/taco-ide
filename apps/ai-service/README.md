# TACO-IDE AI Service

LLM-powered code hints and analysis for educational programming platform.

## Quick Start

### Prerequisites
- Python 3.11+
- uv installed (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Anthropic API key

### Setup

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Add your Anthropic API key to .env
# ANTHROPIC_API_KEY=sk-ant-...

# 3. Install dependencies
uv sync

# 4. Run the service
uv run uvicorn src.main:app --reload --port 8000
```

The service will be available at http://localhost:8000

## API Documentation

Once running, visit:
- **Health Check**: http://localhost:8000/health
- **API Docs**: http://localhost:8000/docs (Swagger UI)

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `BACKEND_API_URL` | Backend API URL | Yes |
| `INTERNAL_API_SECRET` | Shared secret for service auth | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes* |
| `OPENAI_API_KEY` | OpenAI API key | Yes* |
| `HOST` | Server host | No (default: 0.0.0.0) |
| `PORT` | Server port | No (default: 8000) |

*At least one LLM provider key required

## Development

### Project Structure
```
src/
├── main.py           # FastAPI app
├── config.py         # Settings
├── models/           # Pydantic models
├── services/         # Business logic
├── routers/          # API endpoints
└── middleware/       # Auth middleware
```

### Key Commands

```bash
# Run with hot reload
uv run uvicorn src.main:app --reload

# Install new dependency
uv add <package-name>

# Update dependencies
uv sync
```

## Docker

```bash
# Build
docker build -t taco-ai-service .

# Run
docker run -p 8000:8000 --env-file .env taco-ai-service
```

## Architecture

This service:
- **Has NO direct database access**
- Calls backend API for all data operations
- Uses Anthropic Claude for generating hints
- Provides educational guidance (not solutions)

## Documentation

See [CLAUDE.md](./CLAUDE.md) for detailed documentation.
