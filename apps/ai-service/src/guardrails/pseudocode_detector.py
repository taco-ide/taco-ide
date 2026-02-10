"""
Guardrail that detects and strips pseudocode/generic code blocks from LLM response.
"""

import re

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class PseudocodeDetectorGuardrail(Guardrail):
    """Detects pseudocode and generic code patterns (strict only)."""

    @property
    def name(self) -> str:
        return "PseudocodeDetector"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Detect and remove pseudocode and generic code patterns."""
        response = ctx.llm_response
        modified = response

        # Pattern for generic function/loop pseudocode
        # E.g. "function name(params)", "for each item", "loop through"
        patterns = [
            r"\bfunction\s+\w+\s*\(",  # function name(
            r"\bfor\s+each\s+\w+",  # for each item
            r"\bwhile\s+\w+",  # while condition
            r"\breturn\s+\w+",  # return value
            r"\bif\s+\w+\s+(then|:)",  # if condition then/:
        ]

        for pattern in patterns:
            if re.search(pattern, modified, re.IGNORECASE):
                # Replace the entire response with a hint about avoiding pseudocode
                modified = (
                    "I notice I was about to provide pseudocode. Instead, "
                    "I encourage you to think about the problem step by step. "
                    "What parts of the solution do you understand? "
                    "Where are you getting stuck?"
                )
                return GuardrailResult(
                    action=GuardrailAction.MODIFY,
                    content=modified,
                    reason="Detected pseudocode pattern",
                )

        return GuardrailResult(action=GuardrailAction.ALLOW)
