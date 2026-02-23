# AI Service - Source Code Structure

> **Last updated**: commit `183e61e`

## Overview

This directory contains the FastAPI application source code for the AI service. The codebase follows a clean, layered architecture with clear separation of concerns.

## Directory Structure

```
src/
├── __init__.py           # Package marker
├── main.py               # FastAPI app factory and configuration
├── config.py             # Environment settings (pydantic-settings)
├── models/               # Pydantic schemas for request/response
│   ├── chat.py          # ChatRequest, ChatResponse, ChatMessage
│   └── health.py        # Health check response model
├── routers/              # FastAPI route handlers (HTTP layer)
│   └── chat.py          # POST /chat endpoint
├── services/             # Business logic and external integrations
│   └── llm.py           # OpenAI LLM service
├── prompts/              # Prompt construction logic
│   └── builder.py       # System prompt building
├── guardrails/           # Input/output safety checks (10 guardrails)
│   ├── base.py          # Base Guardrail ABC and types
│   ├── chain.py         # GuardrailChain (Chain of Responsibility)
│   ├── presets.py       # Preset guardrail configurations
│   ├── code_detector.py # Code detection guardrail
│   ├── pseudocode_detector.py  # Pseudocode detection guardrail
│   ├── prompt_injection.py     # Prompt injection detection
│   ├── prompt_rules.py         # Prompt rules guardrail
│   ├── output_length.py        # Output length validation
│   └── token_limit.py          # Token limit guardrail
└── middleware/           # FastAPI middleware (currently empty)
```

## Architecture Layers

### Layer 1: HTTP (Routers)

**Purpose**: Handle HTTP requests/responses, validation, error mapping

```python
# routers/chat.py
@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    - Validate request via Pydantic
    - Call services/prompts/guardrails
    - Map exceptions to HTTP status codes
    - Return typed response
    """
```

**Rules**:
- No business logic — delegate to services
- Always specify `response_model`
- Map domain exceptions to HTTP status codes
- Use `raise ... from e` to preserve exception chains

### Layer 2: Services

**Purpose**: Stateless async business logic

```python
# services/llm.py
class LLMService:
    async def generate_hint(self, request: ChatRequest) -> str:
        """Call OpenAI API with structured prompts."""
```

**Rules**:
- Async methods for all I/O operations
- Do NOT raise `HTTPException` — raise domain exceptions
- Module-level singleton pattern: `llm_service = LLMService()`
- No imports from `routers` layer

### Layer 3: Prompts

**Purpose**: Build system prompts and message arrays

```python
# prompts/builder.py
def build_system_prompt(ta: TeachingAssistant, kb: list[str]) -> str:
    """Construct system prompt from TA config and knowledge base."""
```

**Rules**:
- Pure functions (no state, no I/O)
- Return structured prompts as strings or message lists
- Include clear instructions for educational guidance

### Layer 4: Guardrails

**Purpose**: Safety checks using Chain of Responsibility pattern

```python
# guardrails/base.py
class Guardrail(ABC):
    @abstractmethod
    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Returns ALLOW or BLOCK with reason."""
```

**Rules**:
- Each guardrail is independent and stateless
- Must return `GuardrailResult`, never raise exceptions
- Register in `presets.py` for composition
- One guardrail per file in `guardrails/` directory

### Layer 5: Models

**Purpose**: Pydantic schemas for validation and serialization

```python
# models/chat.py
class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    code: str
    message: str = Field(..., alias="studentMessage")
```

**Rules**:
- All models use `ConfigDict(populate_by_name=True)`
- Use `Field(..., alias="camelCase")` for JSON camelCase fields
- Use `X | None` instead of `Optional[X]`
- Include docstrings and field descriptions

### Layer 6: Configuration

**Purpose**: Environment variable management

```python
# config.py
class Settings(BaseSettings):
    openai_api_key: str = Field(..., alias="OPENAI_API_KEY")
    llm_model: str = Field(default="gpt-4o-mini", alias="LLM_MODEL")
```

**Rules**:
- All settings come from environment variables
- No hardcoded secrets or configuration
- Use `pydantic-settings` for validation

## Dependency Flow

```
main.py
  ↓
routers/ → services/ → models/
         → prompts/  → config.py
         → guardrails/
```

**One-way dependencies** (no circular imports):
- Routers → Services, Prompts, Guardrails, Models
- Services → Models, Config
- Guardrails → Base types only
- Models → (nothing internal)

## Adding New Features

### 1. New Endpoint

1. Create model in `models/` for request/response
2. Create router in `routers/` with typed endpoint
3. Add business logic in `services/` if needed
4. Register router in `main.py`

### 2. New Guardrail

1. Create new file in `guardrails/` (one guardrail per file)
2. Implement class extending `Guardrail` with `name` property and `execute()` method
3. Register in `guardrails/presets.py`
4. Write tests in `tests/test_guardrails_<name>.py`

### 3. New LLM Provider

1. Update `config.py` with new settings
2. Modify `services/llm.py` to support new provider
3. Update `.env.example` with new variables
4. Document in `CLAUDE.md` (parent directory)

## Common Patterns

### Error Handling in Routers

```python
try:
    result = await service.do_thing(request)
    return Response(data=result)
except ValueError as e:
    raise HTTPException(status_code=422, detail=str(e)) from e
except HTTPException:
    raise  # Don't wrap HTTPException
except Exception as e:
    logger.exception("Unexpected error in endpoint")
    raise HTTPException(status_code=500, detail="Internal error") from e
```

### Service Pattern

```python
class MyService:
    """Service for X functionality."""

    def __init__(self, config: str) -> None:
        self._config = config

    async def async_operation(self, input: str) -> str:
        """Perform async I/O operation."""
        # Business logic here
        return result

# Module-level singleton
my_service = MyService(config=settings.some_value)
```

### Guardrail Pattern

```python
class MyGuardrail(Guardrail):
    """Check for specific condition."""

    @property
    def name(self) -> str:
        return "my-guardrail"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Check condition and return result."""
        if should_block(ctx):
            return GuardrailResult(
                action=GuardrailAction.BLOCK,
                reason="Specific reason for blocking"
            )
        return GuardrailResult(action=GuardrailAction.ALLOW)
```

## Code Style Reference

- **Python**: 3.11+ (use `X | Y` unions, `list[str]` generics)
- **Line length**: 100 characters
- **Naming**: snake_case for functions/variables, PascalCase for classes
- **Type hints**: Required on all function signatures
- **Docstrings**: Google style for all public functions/classes
- **Imports**: stdlib → third-party → local, alphabetized

## Related Documentation

- **Parent CLAUDE.md**: Full service documentation and coding standards
- **Tests CLAUDE.md**: Testing patterns and conventions (`tests/CLAUDE.md`)
- **Root CLAUDE.md**: Monorepo overview (`../../CLAUDE.md`)
