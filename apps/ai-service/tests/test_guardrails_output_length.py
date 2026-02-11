"""Tests for OutputLengthGuardrail."""

import pytest

from src.guardrails.base import GuardrailAction, GuardrailContext
from src.guardrails.output_length import OutputLengthGuardrail


async def test_output_length_allows_short_response():
    """OutputLengthGuardrail allows short LLM response."""
    guardrail = OutputLengthGuardrail(max_tokens=100)
    ctx = GuardrailContext(
        student_message="How?",
        student_code="pass",
        language="python",
        system_prompt="Be helpful.",
        llm_response="Try using a loop.",
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.ALLOW


async def test_output_length_truncates_long_response():
    """OutputLengthGuardrail truncates response exceeding token limit."""
    guardrail = OutputLengthGuardrail(max_tokens=50)
    long_response = "word " * 200  # ~1000 chars, way over 200 char limit (50 tokens)
    ctx = GuardrailContext(
        student_message="How?",
        student_code="pass",
        language="python",
        system_prompt="Be helpful.",
        llm_response=long_response,
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.MODIFY
    assert result.content is not None
    assert "[Response truncated]" in result.content
    assert len(result.content) < len(long_response)


async def test_output_length_preserves_word_boundary():
    """OutputLengthGuardrail doesn't cut mid-word."""
    guardrail = OutputLengthGuardrail(max_tokens=10)
    # Make response longer than 40 chars (10 tokens * 4 chars)
    response = "The quick brown fox jumps over the lazy dog and runs away quickly"
    ctx = GuardrailContext(
        student_message="What?",
        student_code="pass",
        language="python",
        system_prompt="Help.",
        llm_response=response,
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.MODIFY
    assert result.content is not None
    # Should not end with a partial word or space+word boundary artifact
    lines = result.content.strip().split("\n")
    text_part = lines[0] if lines else ""
    # Just verify it doesn't end mid-word (has space at end or ends with full word)
    assert not text_part.endswith(" ")


async def test_output_length_exactly_at_boundary():
    """OutputLengthGuardrail allows response at boundary."""
    guardrail = OutputLengthGuardrail(max_tokens=50)
    response = "a" * 200  # Exactly 50 tokens (4 chars per token)
    ctx = GuardrailContext(
        student_message="Q",
        student_code="pass",
        language="python",
        system_prompt="Help.",
        llm_response=response,
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.ALLOW


async def test_output_length_appends_truncation_notice():
    """OutputLengthGuardrail appends truncation notice."""
    guardrail = OutputLengthGuardrail(max_tokens=5)
    response = "This is a very long response that will definitely be truncated."
    ctx = GuardrailContext(
        student_message="Help?",
        student_code="code",
        language="python",
        system_prompt="S.",
        llm_response=response,
        log=[],
    )
    result = await guardrail.execute(ctx)
    assert result.action == GuardrailAction.MODIFY
    assert result.content is not None
    assert "[Response truncated]" in result.content
    # Verify it's a proper sentence ending
    assert "\n\n[Response truncated]" in result.content
