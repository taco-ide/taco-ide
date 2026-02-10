"""
Guardrail chain runner that orchestrates before and after guardrails.
"""

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class GuardrailChain:
    """Orchestrates a sequence of guardrails before and after LLM calls."""

    def __init__(self, before_llm: list[Guardrail] | None = None, after_llm: list[Guardrail] | None = None):
        """Initialize chain with before and after guardrail lists.

        Args:
            before_llm: Guardrails to run before LLM call
            after_llm: Guardrails to run after LLM call
        """
        self.before_llm = before_llm or []
        self.after_llm = after_llm or []

    async def run_before(self, ctx: GuardrailContext) -> GuardrailResult | None:
        """Run all before-LLM guardrails.

        Returns:
            GuardrailResult if any guardrail blocks, None if all pass/modify
        """
        for guardrail in self.before_llm:
            result = await guardrail.execute(ctx)
            ctx.log.append(f"[before] {guardrail.name}: {result.action.value}")

            if result.action == GuardrailAction.BLOCK:
                return result

            if result.action == GuardrailAction.MODIFY and result.content is not None:
                # For before guardrails, MODIFY typically means modifying the system prompt
                ctx.system_prompt = result.content

        return None

    async def run_after(self, ctx: GuardrailContext) -> GuardrailResult | None:
        """Run all after-LLM guardrails.

        Returns:
            GuardrailResult if any guardrail blocks, None if all pass/modify
        """
        for guardrail in self.after_llm:
            result = await guardrail.execute(ctx)
            ctx.log.append(f"[after] {guardrail.name}: {result.action.value}")

            if result.action == GuardrailAction.BLOCK:
                return result

            if result.action == GuardrailAction.MODIFY and result.content is not None:
                # For after guardrails, MODIFY means modifying the LLM response
                ctx.llm_response = result.content

        return None
