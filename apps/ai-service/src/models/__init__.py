"""
Pydantic models for AI service.
"""

from .chat import ChatRequest, ChatResponse
from .exercise import Exercise

__all__ = ["ChatRequest", "ChatResponse", "Exercise"]
