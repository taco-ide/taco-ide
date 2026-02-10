"""
Shared test fixtures and configuration.

IMPORTANT: OPENAI_API_KEY must be set before any src.* imports to prevent
LLMService() from raising ValueError at module level.
"""

import os

# Set fake key before any src.* imports trigger LLMService instantiation
os.environ.setdefault("OPENAI_API_KEY", "sk-test-fake-key")

import pytest
from httpx import ASGITransport, AsyncClient

from src.guardrails.base import GuardrailContext
from src.main import app
from src.models.chat import (
    ChatMessage,
    ChatRequest,
    ExerciseContext,
    TeachingAssistantContext,
)


@pytest.fixture
def sample_exercise():
    return ExerciseContext(
        title="Add Two Numbers",
        description="Write a function that adds two numbers",
    )


@pytest.fixture
def sample_ta():
    return TeachingAssistantContext(
        system_prompt="You are a helpful Python tutor.",
        target_audience="Beginner",
    )


@pytest.fixture
def sample_chat_request(sample_exercise, sample_ta):
    return ChatRequest(
        code="def add(a, b):\n    pass",
        language="python",
        message="How do I add two numbers?",
        exercise=sample_exercise,
        teaching_assistant=sample_ta,
        knowledge_base=["Python docs on functions"],
        chat_history=[],
        guardrail_preset="medium",
    )


@pytest.fixture
def sample_guardrail_context():
    return GuardrailContext(
        student_message="How do I add two numbers?",
        student_code="def add(a, b):\n    pass",
        language="python",
        system_prompt="You are a helpful tutor.",
        llm_response="",
        log=[],
    )


@pytest.fixture
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        yield client
