"""
Tests for GuardrailChain orchestration and build_preset factory.
"""

import pytest

from src.guardrails.base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult
from src.guardrails.chain import GuardrailChain
from src.guardrails.presets import build_preset


def make_ctx(system_prompt: str = "Base.", llm_response: str = "LLM says hi.") -> GuardrailContext:
    return GuardrailContext(
        student_message="question",
        student_code="code",
        language="python",
        system_prompt=system_prompt,
        llm_response=llm_response,
        log=[],
    )


class AlwaysBlockGuardrail(Guardrail):
    @property
    def name(self) -> str:
        return "AlwaysBlock"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        return GuardrailResult(action=GuardrailAction.BLOCK, reason="Always blocks")


class AlwaysModifyGuardrail(Guardrail):
    def __init__(self, content: str):
        self.content = content

    @property
    def name(self) -> str:
        return "AlwaysModify"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        return GuardrailResult(action=GuardrailAction.MODIFY, content=self.content)


class AlwaysAllowGuardrail(Guardrail):
    @property
    def name(self) -> str:
        return "AlwaysAllow"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        return GuardrailResult(action=GuardrailAction.ALLOW)


# --- GuardrailChain ---

class TestGuardrailChain:
    async def test_run_before_block_stops_chain_early(self):
        ctx = make_ctx()
        chain = GuardrailChain(
            before_llm=[AlwaysBlockGuardrail(), AlwaysModifyGuardrail("should not reach")],
        )
        result = await chain.run_before(ctx)
        assert result is not None
        assert result.action == GuardrailAction.BLOCK
        # Only the block guardrail should have been logged
        assert len(ctx.log) == 1

    async def test_run_before_modify_updates_system_prompt(self):
        ctx = make_ctx(system_prompt="Original.")
        chain = GuardrailChain(
            before_llm=[AlwaysModifyGuardrail("Modified system prompt.")],
        )
        result = await chain.run_before(ctx)
        assert result is None
        assert ctx.system_prompt == "Modified system prompt."

    async def test_run_before_all_allow_returns_none(self):
        ctx = make_ctx()
        chain = GuardrailChain(
            before_llm=[AlwaysAllowGuardrail(), AlwaysAllowGuardrail()],
        )
        result = await chain.run_before(ctx)
        assert result is None

    async def test_run_after_block_stops_chain_early(self):
        ctx = make_ctx(llm_response="LLM response.")
        chain = GuardrailChain(
            after_llm=[AlwaysBlockGuardrail(), AlwaysModifyGuardrail("should not reach")],
        )
        result = await chain.run_after(ctx)
        assert result is not None
        assert result.action == GuardrailAction.BLOCK

    async def test_run_after_modify_updates_llm_response(self):
        ctx = make_ctx(llm_response="Original response.")
        chain = GuardrailChain(
            after_llm=[AlwaysModifyGuardrail("Filtered response.")],
        )
        result = await chain.run_after(ctx)
        assert result is None
        assert ctx.llm_response == "Filtered response."

    async def test_empty_chain_returns_none(self):
        ctx = make_ctx()
        chain = GuardrailChain()
        assert await chain.run_before(ctx) is None
        assert await chain.run_after(ctx) is None

    async def test_chain_appends_to_log(self):
        ctx = make_ctx()
        chain = GuardrailChain(
            before_llm=[AlwaysAllowGuardrail()],
            after_llm=[AlwaysAllowGuardrail()],
        )
        await chain.run_before(ctx)
        await chain.run_after(ctx)
        assert len(ctx.log) == 2
        assert any("[before]" in entry for entry in ctx.log)
        assert any("[after]" in entry for entry in ctx.log)


# --- build_preset ---

class TestBuildPreset:
    def test_loose_preset_has_correct_guardrails(self):
        chain = build_preset("loose")
        assert len(chain.before_llm) == 2
        assert len(chain.after_llm) == 1

    def test_medium_preset_has_correct_guardrails(self):
        chain = build_preset("medium")
        assert len(chain.before_llm) == 2
        assert len(chain.after_llm) == 1

    def test_strict_preset_has_correct_guardrails(self):
        chain = build_preset("strict")
        assert len(chain.before_llm) == 2
        assert len(chain.after_llm) == 2

    def test_build_preset_returns_fresh_instance_each_call(self):
        chain1 = build_preset("medium")
        chain2 = build_preset("medium")
        assert chain1 is not chain2

    def test_invalid_preset_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown preset"):
            build_preset("invalid")

    def test_empty_preset_raises_value_error(self):
        with pytest.raises(ValueError):
            build_preset("")
