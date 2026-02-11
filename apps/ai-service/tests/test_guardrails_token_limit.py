"""Tests for TokenLimitGuardrail."""

import pytest

from src.guardrails.base import GuardrailAction, GuardrailContext
from src.guardrails.token_limit import TokenLimitGuardrail


async def test_token_limit_allows_short_input():
    """TokenLimitGuardrail allows short input."""
    guardrail = TokenLimitGuardrail(max_tokens=100)
    ctx = GuardrailContext(
        student_message="How do I add?",
        student_code="pass",
        language="python",
        system_prompt="You are helpful.",
        llm_response="",
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.ALLOW


async def test_token_limit_blocks_oversized_input():
    """TokenLimitGuardrail blocks input exceeding token limit."""
    guardrail = TokenLimitGuardrail(max_tokens=100)
    ctx = GuardrailContext(
        student_message="x" * 1000,
        student_code="y" * 1000,
        language="python",
        system_prompt="z" * 1000,
        llm_response="",
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.BLOCK
    assert "Estimated input tokens" in result.reason


async def test_token_limit_counts_system_prompt_and_code():
    """TokenLimitGuardrail counts tokens from all input fields."""
    # Exactly 400 characters = 100 tokens (4 chars per token)
    guardrail = TokenLimitGuardrail(max_tokens=100)
    ctx = GuardrailContext(
        student_message="a" * 100,
        student_code="b" * 100,
        language="python",
        system_prompt="c" * 200,
        llm_response="",
        log=[],
    )
    result = await guardrail.execute(ctx)
    # Total: 400 chars = 100 tokens, should be at boundary
    assert result.action == GuardrailAction.ALLOW


async def test_token_limit_exactly_at_boundary():
    """TokenLimitGuardrail allows input at boundary."""
    guardrail = TokenLimitGuardrail(max_tokens=100)
    # Exactly 400 chars = 100 tokens
    text = "a" * 400
    ctx = GuardrailContext(
        student_message=text,
        student_code="",
        language="python",
        system_prompt="",
        llm_response="",
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.ALLOW


async def test_token_limit_just_over_boundary():
    """TokenLimitGuardrail blocks input just over token boundary."""
    guardrail = TokenLimitGuardrail(max_tokens=100)
    # 405 chars = 101 tokens (rounded down from 405 // 4 = 101.25), over limit of 100
    text = "a" * 405
    ctx = GuardrailContext(
        student_message=text,
        student_code="",
        language="python",
        system_prompt="",
        llm_response="",
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.BLOCK
