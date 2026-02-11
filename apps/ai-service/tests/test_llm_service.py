"""
Tests for LLMService.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from src.services.llm import llm_service


def test_llm_service_is_instantiated():
    """Service should be instantiated without error (OPENAI_API_KEY is set in conftest)."""
    assert llm_service is not None
    assert llm_service.client is not None


def test_llm_service_loads_config():
    """Service should load LLM configuration from settings."""
    assert llm_service.model == "gpt-4o-mini"
    assert llm_service.max_tokens == 1024
    assert llm_service.temperature == 1.0


async def test_generate_returns_llm_content():
    """Generate should return content from LLM response."""
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "Here is a helpful hint!"

    original_client = llm_service.client
    try:
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        llm_service.client = mock_client

        result = await llm_service.generate(
            system_prompt="You are a tutor.",
            messages=[{"role": "user", "content": "How do I add two numbers?"}],
        )

        assert result == "Here is a helpful hint!"
    finally:
        llm_service.client = original_client


async def test_generate_passes_system_prompt_as_first_message():
    """Generate should include system prompt as first message."""
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "Response"

    original_client = llm_service.client
    try:
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        llm_service.client = mock_client

        await llm_service.generate(
            system_prompt="System instruction.",
            messages=[{"role": "user", "content": "Question."}],
        )

        call_args = mock_client.chat.completions.create.call_args
        messages_sent = call_args.kwargs["messages"]
        assert messages_sent[0] == {"role": "system", "content": "System instruction."}
        assert messages_sent[1] == {"role": "user", "content": "Question."}
    finally:
        llm_service.client = original_client


async def test_generate_uses_configured_model():
    """Generate should use model from config."""
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "Response"

    original_client = llm_service.client
    try:
        mock_client = MagicMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        llm_service.client = mock_client

        await llm_service.generate(
            system_prompt="Prompt",
            messages=[{"role": "user", "content": "Message"}],
        )

        call_args = mock_client.chat.completions.create.call_args
        assert call_args.kwargs["model"] == llm_service.model
        assert call_args.kwargs["max_tokens"] == llm_service.max_tokens
        assert call_args.kwargs["temperature"] == llm_service.temperature
    finally:
        llm_service.client = original_client
