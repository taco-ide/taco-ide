"""
Chat request/response models.
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class GuardrailConfig(BaseModel):
    """Per-TA guardrail configuration overrides.

    All fields are optional. Absent fields fall back to the preset defaults.
    """

    model_config = ConfigDict(populate_by_name=True)

    preset: str = Field(default="medium", description="Base preset: loose, medium, or strict")
    block_code: bool | None = Field(default=None, alias="blockCode")
    block_pseudocode: bool | None = Field(default=None, alias="blockPseudocode")
    max_input_tokens: int | None = Field(default=None, alias="maxInputTokens")
    max_output_tokens: int | None = Field(default=None, alias="maxOutputTokens")
    custom_rules: str | None = Field(default=None, alias="customRules")


class ExerciseContext(BaseModel):
    """Exercise data sent by the backend."""

    model_config = ConfigDict(populate_by_name=True)

    title: str
    description: str | None = None
    support_materials: Any = Field(default=None, alias="supportMaterials")
    possible_solutions: Any = Field(default=None, alias="possibleSolutions")


class TeachingAssistantContext(BaseModel):
    """Teaching assistant config sent by the backend."""

    model_config = ConfigDict(populate_by_name=True)

    system_prompt: str = Field(..., alias="systemPrompt")
    target_audience: str | None = Field(default=None, alias="targetAudience")
    guardrail_config: GuardrailConfig | None = Field(default=None, alias="guardrailConfig")


class ChatMessage(BaseModel):
    """A single message in chat history.

    Each message must have a role (either 'user' or 'assistant') and content.
    """

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "examples": [
                {"role": "user", "content": "What is a function?"},
                {"role": "assistant", "content": "A function is a reusable block of code..."}
            ]
        }
    )

    role: Literal["user", "assistant"] = Field(
        ...,
        description="Message role - must be either 'user' (for student messages) or 'assistant' (for AI responses)"
    )
    content: str = Field(
        ...,
        description="The actual message content",
        min_length=1
    )


class ChatRequest(BaseModel):
    """Request model for AI chat endpoint.

    This endpoint generates AI-powered hints for students working on coding exercises.
    """

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "examples": [{
                "code": "def add(a, b):\n    pass",
                "language": "python",
                "message": "How do I add two numbers?",
                "exercise": {
                    "title": "Add Two Numbers",
                    "description": "Write a function that adds two numbers"
                },
                "teachingAssistant": {
                    "systemPrompt": "You are a helpful Python tutor for beginners."
                },
                "knowledgeBase": [],
                "chatHistory": [
                    {"role": "user", "content": "What is a function?"},
                    {"role": "assistant", "content": "A function is a reusable block of code that performs a specific task."}
                ]
            }]
        }
    )

    code: str = Field(
        ...,
        description="Student's current code",
        examples=["def add(a, b):\n    pass"]
    )
    language: str = Field(
        ...,
        description="Programming language (e.g., 'python', 'javascript', 'java')",
        examples=["python", "javascript"]
    )
    message: str = Field(
        ...,
        description="Student's question or message to the AI assistant",
        min_length=1,
        examples=["How do I add two numbers?", "What's wrong with my code?"]
    )
    exercise: ExerciseContext = Field(
        ...,
        description="Exercise context including title and description"
    )
    teaching_assistant: TeachingAssistantContext = Field(
        ...,
        alias="teachingAssistant",
        description="Teaching assistant configuration with system prompt and guardrails"
    )
    knowledge_base: list[str] = Field(
        default_factory=list,
        alias="knowledgeBase",
        description="Optional knowledge base entries to provide additional context to the AI"
    )
    chat_history: list[ChatMessage] = Field(
        default_factory=list,
        alias="chatHistory",
        description="Previous conversation messages. Each message must have 'role' ('user' or 'assistant') and 'content' fields."
    )
    guardrail_preset: Literal["loose", "medium", "strict"] = Field(
        default="medium",
        alias="guardrailPreset",
        description="Guardrail preset level: 'loose' (permissive), 'medium' (balanced), or 'strict' (restrictive)"
    )


class ChatResponse(BaseModel):
    """Response model for AI chat endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    response: str = Field(..., description="AI-generated response")
    suggestions: list[str] = Field(
        default_factory=list, description="Optional suggestions"
    )
    guardrail_blocked: bool = Field(default=False, alias="guardrailBlocked", description="Whether request was blocked by guardrails")
    guardrail_log: list[str] = Field(
        default_factory=list, alias="guardrailLog", description="Log of guardrail execution"
    )
