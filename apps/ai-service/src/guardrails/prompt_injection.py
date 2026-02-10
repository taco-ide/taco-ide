"""
Guardrail to detect and block prompt injection attempts.
"""

import re

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class PromptInjectionGuardrail(Guardrail):
    """Detects prompt injection patterns in student input."""

    @property
    def name(self) -> str:
        return "PromptInjection"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Detect common prompt injection patterns."""
        # Pattern for common prompt injection attempts
        injection_patterns = [
            r"(?i)(ignore|forget|disregard|forget about).*?(previous|instruction|prompt|system|rule|guideline)",
            r"(?i)(forget|ignore).*?(everything|all|previous).*?(instruction|prompt|system)",
            r"(?i)(you are now|now you are|act as|pretend|behave as|roleplay as).*?(?:without|don't|do not).*?(restriction|rule|guideline)",
            r"(?i)(system|admin|moderator)\s*(override|breakout|jailbreak|exploit)",
            r"(?i)(print|show|dump|output).*?(system|prompt|instruction|secret|token|key)",
        ]

        for pattern in injection_patterns:
            if re.search(pattern, ctx.student_message):
                return GuardrailResult(
                    action=GuardrailAction.BLOCK,
                    reason="Detected prompt injection attempt",
                )

        return GuardrailResult(action=GuardrailAction.ALLOW)
