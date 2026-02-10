"""
Chat request/response models.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Any


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


class ChatResponse(BaseModel):
    """Response model for AI chat endpoint."""

    response: str = Field(..., description="AI-generated response")
    suggestions: list[str] = Field(
        default_factory=list, description="Optional suggestions"
    )
