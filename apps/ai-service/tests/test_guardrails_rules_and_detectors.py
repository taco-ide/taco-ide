"""
Tests for PromptRulesGuardrail, CodeDetectorGuardrail, and PseudocodeDetectorGuardrail.
"""

import pytest

from src.guardrails.base import GuardrailAction, GuardrailContext
from src.guardrails.code_detector import CodeDetectorGuardrail
from src.guardrails.prompt_rules import PromptRulesGuardrail
from src.guardrails.pseudocode_detector import PseudocodeDetectorGuardrail


def make_ctx(system_prompt: str = "", llm_response: str = "", language: str = "python") -> GuardrailContext:
    return GuardrailContext(
        student_message="question",
        student_code="code",
        language=language,
        system_prompt=system_prompt,
        llm_response=llm_response,
        log=[],
    )


# --- PromptRulesGuardrail ---

class TestPromptRulesGuardrail:
    async def test_loose_appends_loose_rules(self):
        guardrail = PromptRulesGuardrail("loose")
        ctx = make_ctx(system_prompt="Base prompt.")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY
        assert "Loose" in result.content
        assert result.content.startswith("Base prompt.")

    async def test_medium_appends_medium_rules(self):
        guardrail = PromptRulesGuardrail("medium")
        ctx = make_ctx(system_prompt="Base prompt.")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY
        assert "Medium" in result.content

    async def test_strict_appends_strict_rules(self):
        guardrail = PromptRulesGuardrail("strict")
        ctx = make_ctx(system_prompt="Base prompt.")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY
        assert "Strict" in result.content

    async def test_name_includes_level(self):
        assert PromptRulesGuardrail("loose").name == "PromptRules(loose)"
        assert PromptRulesGuardrail("medium").name == "PromptRules(medium)"
        assert PromptRulesGuardrail("strict").name == "PromptRules(strict)"

    async def test_result_has_reason(self):
        guardrail = PromptRulesGuardrail("medium")
        ctx = make_ctx(system_prompt="Base.")
        result = await guardrail.execute(ctx)
        assert result.reason is not None

    async def test_original_prompt_preserved_in_modified(self):
        guardrail = PromptRulesGuardrail("strict")
        original = "You are a tutor."
        ctx = make_ctx(system_prompt=original)
        result = await guardrail.execute(ctx)
        assert original in result.content


# --- CodeDetectorGuardrail ---

class TestCodeDetectorGuardrail:
    async def test_strips_language_specific_code_block(self):
        guardrail = CodeDetectorGuardrail()
        ctx = make_ctx(
            llm_response="Here is how:\n```python\ndef add(a, b):\n    return a + b\n```\nTry it!",
            language="python",
        )
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY
        assert "def add" not in result.content
        assert "[code block removed]" in result.content

    async def test_strips_generic_code_block(self):
        guardrail = CodeDetectorGuardrail()
        ctx = make_ctx(
            llm_response="Here:\n```\nsome code\n```\nDone.",
            language="python",
        )
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY
        assert "some code" not in result.content

    async def test_clean_response_is_allowed(self):
        guardrail = CodeDetectorGuardrail()
        ctx = make_ctx(
            llm_response="Think about what return means in a function.",
            language="python",
        )
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.ALLOW

    async def test_name_property(self):
        assert CodeDetectorGuardrail().name == "CodeDetector"

    async def test_javascript_blocks_stripped(self):
        guardrail = CodeDetectorGuardrail()
        ctx = make_ctx(
            llm_response="Try:\n```javascript\nconsole.log('hi');\n```",
            language="javascript",
        )
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY
        assert "console.log" not in result.content


# --- PseudocodeDetectorGuardrail ---

class TestPseudocodeDetectorGuardrail:
    async def test_function_definition_triggers_modify(self):
        guardrail = PseudocodeDetectorGuardrail()
        ctx = make_ctx(llm_response="You can use: function add(a, b) { ... }")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY

    async def test_for_each_triggers_modify(self):
        guardrail = PseudocodeDetectorGuardrail()
        ctx = make_ctx(llm_response="Think about: for each item in the list...")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY

    async def test_while_triggers_modify(self):
        guardrail = PseudocodeDetectorGuardrail()
        ctx = make_ctx(llm_response="Consider: while condition is true, keep looping.")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY

    async def test_clean_response_is_allowed(self):
        guardrail = PseudocodeDetectorGuardrail()
        ctx = make_ctx(llm_response="Think about what operation combines two values into one.")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.ALLOW

    async def test_modified_content_is_educational_message(self):
        guardrail = PseudocodeDetectorGuardrail()
        ctx = make_ctx(llm_response="function solve(input) { return result }")
        result = await guardrail.execute(ctx)
        assert result.action == GuardrailAction.MODIFY
        assert "step by step" in result.content.lower() or "think" in result.content.lower()

    async def test_name_property(self):
        assert PseudocodeDetectorGuardrail().name == "PseudocodeDetector"
