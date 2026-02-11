"""Token limit guardrail — blocks oversized requests before LLM call."""

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class TokenLimitGuardrail(Guardrail):
    """Blocks the request if the estimated input token count exceeds a threshold.

    Uses a character-based heuristic (4 chars ≈ 1 token). This is a safety
    valve, not a precise counter. For educational guardrails, approximate
    limits are acceptable.
    """

    def __init__(self, max_tokens: int) -> None:
        """Initialize with a token limit.

        Args:
            max_tokens: Maximum allowed estimated input tokens.
        """
        self._max_tokens = max_tokens

    @property
    def name(self) -> str:
        return f"TokenLimit(max={self._max_tokens})"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Block request if estimated input token count exceeds limit."""
        text = ctx.system_prompt + ctx.student_message + ctx.student_code
        estimated_tokens = len(text) // 4
        if estimated_tokens > self._max_tokens:
            return GuardrailResult(
                action=GuardrailAction.BLOCK,
                reason=f"Estimated input tokens ({estimated_tokens}) exceeds limit ({self._max_tokens})",
            )
        return GuardrailResult(action=GuardrailAction.ALLOW)
