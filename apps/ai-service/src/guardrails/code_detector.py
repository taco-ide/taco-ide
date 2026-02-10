"""
Guardrail that strips fenced code blocks in the target language from LLM response.
"""

import re

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class CodeDetectorGuardrail(Guardrail):
    """Detects and strips code blocks in the student's target language."""

    @property
    def name(self) -> str:
        return "CodeDetector"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Remove fenced code blocks in the target language."""
        # Pattern to match fenced code blocks (``` or ~~~)
        # First try language-specific blocks
        pattern = rf"```{re.escape(ctx.language)}(.*?)```"
        modified = re.sub(pattern, "[code block removed]", ctx.llm_response, flags=re.DOTALL | re.IGNORECASE)

        # If we removed code, return modified response
        if modified != ctx.llm_response:
            return GuardrailResult(
                action=GuardrailAction.MODIFY,
                content=modified,
                reason=f"Removed code blocks in {ctx.language}",
            )

        # Also check for generic code blocks without language specification
        pattern = r"```(.*?)```"
        modified = re.sub(pattern, "[code block removed]", ctx.llm_response, flags=re.DOTALL)

        if modified != ctx.llm_response:
            return GuardrailResult(
                action=GuardrailAction.MODIFY,
                content=modified,
                reason="Removed generic code blocks",
            )

        return GuardrailResult(action=GuardrailAction.ALLOW)
