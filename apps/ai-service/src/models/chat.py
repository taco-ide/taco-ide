"""
Chat request/response models.
"""

from pydantic import BaseModel, Field
from typing import Any


class ExerciseContext(BaseModel):
    """Exercise data sent by the backend."""

    title: str
    description: str | None = None
    support_materials: Any = None
    possible_solutions: Any = None


class TeachingAssistantContext(BaseModel):
    """Teaching assistant config sent by the backend."""

    system_prompt: str
    target_audience: str | None = None


class ChatMessage(BaseModel):
    """A single message in chat history."""

    role: str
    content: str


class ChatRequest(BaseModel):
    """Request model for AI chat endpoint."""

    code: str = Field(..., description="Student's current code")
    language: str = Field(..., description="Programming language")
    message: str = Field(..., description="Student's question or message")
    exercise: ExerciseContext = Field(..., description="Exercise context")
    teaching_assistant: TeachingAssistantContext = Field(
        ..., description="TA configuration"
    )
    knowledge_base: list[str] = Field(
        default_factory=list, description="Knowledge base entries"
    )
    chat_history: list[ChatMessage] = Field(
        default_factory=list, description="Previous conversation"
    )


class ChatResponse(BaseModel):
    """Response model for AI chat endpoint."""

    response: str = Field(..., description="AI-generated response")
    suggestions: list[str] = Field(
        default_factory=list, description="Optional suggestions"
    )
