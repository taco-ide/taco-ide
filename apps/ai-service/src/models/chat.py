"""
Chat request/response models.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Any


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
    """A single message in chat history."""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Request model for AI chat endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    code: str = Field(..., description="Student's current code")
    language: str = Field(..., description="Programming language")
    message: str = Field(..., description="Student's question or message")
    exercise: ExerciseContext = Field(..., description="Exercise context")
    teaching_assistant: TeachingAssistantContext = Field(
        ..., alias="teachingAssistant", description="TA configuration"
    )
    knowledge_base: list[str] = Field(
        default_factory=list, alias="knowledgeBase", description="Knowledge base entries"
    )
    chat_history: list[ChatMessage] = Field(
        default_factory=list, alias="chatHistory", description="Previous conversation"
    )
    guardrail_preset: str = Field(
        default="medium", alias="guardrailPreset", description="Guardrail preset: loose, medium, or strict"
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
