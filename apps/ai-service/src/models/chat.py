"""
Chat request/response models.
"""

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Request model for AI chat endpoint."""

    exercise_id: int = Field(..., description="ID of the exercise")
    code: str = Field(..., description="Student's current code")
    language: str = Field(..., description="Programming language (e.g., 'python')")
    message: str = Field(..., description="Student's question or message")
    user_id: int = Field(..., description="ID of the user making the request")


class ChatResponse(BaseModel):
    """Response model for AI chat endpoint."""

    response: str = Field(..., description="AI-generated response")
    suggestions: list[str] = Field(
        default_factory=list, description="Optional code suggestions"
    )
