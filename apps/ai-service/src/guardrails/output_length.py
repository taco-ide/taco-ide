"""Output length guardrail — truncates overly long LLM responses."""

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class OutputLengthGuardrail(Guardrail):
    """Truncates LLM response if it exceeds an estimated token threshold.

    Uses the same 4-chars-per-token heuristic as TokenLimitGuardrail.
    Truncation preserves complete words and appends a note.
    """

    def __init__(self, max_tokens: int) -> None:
        """Initialize with a token limit.

        Args:
            max_tokens: Maximum allowed estimated output tokens.
        """
        self._max_tokens = max_tokens

    @property
    def name(self) -> str:
        return f"OutputLength(max={self._max_tokens})"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Truncate response if it exceeds the estimated token limit."""
        max_chars = self._max_tokens * 4
        if len(ctx.llm_response) <= max_chars:
            return GuardrailResult(action=GuardrailAction.ALLOW)
        truncated = ctx.llm_response[:max_chars].rsplit(" ", 1)[0]
        truncated += "\n\n[Response truncated]"
        return GuardrailResult(
            action=GuardrailAction.MODIFY,
            content=truncated,
            reason=f"Response truncated to ~{self._max_tokens} tokens",
        )
