"""
Guardrail that appends safety rules to the system prompt.
"""

from .base import Guardrail, GuardrailAction, GuardrailContext, GuardrailResult


class PromptRulesGuardrail(Guardrail):
    """Appends safety rules to the system prompt based on strictness level."""

    # Rules for different strictness levels
    LOOSE_RULES = """
SAFETY RULES (Loose):
- Provide helpful hints and guidance
- Avoid giving complete solutions
- Focus on learning outcomes"""

    MEDIUM_RULES = """
SAFETY RULES (Medium):
- Provide helpful hints without complete solutions
- Guide the student toward the answer
- Ask clarifying questions when appropriate
- Avoid implementing working code
- Focus on teaching concepts, not coding"""

    STRICT_RULES = """
SAFETY RULES (Strict):
- Only provide hints, never solutions
- Do not write any functional code
- Ask questions to guide thinking
- Reference documentation instead of explaining
- Never provide step-by-step implementation
- Encourage independent problem-solving"""

    def __init__(self, level: str = "medium"):
        """Initialize with strictness level.

        Args:
            level: One of "loose", "medium", or "strict"
        """
        self.level = level.lower()
        self.rules_map = {
            "loose": self.LOOSE_RULES,
            "medium": self.MEDIUM_RULES,
            "strict": self.STRICT_RULES,
        }

    @property
    def name(self) -> str:
        return f"PromptRules({self.level})"

    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Append rules to system prompt."""
        rules = self.rules_map.get(self.level, self.MEDIUM_RULES)
        modified_prompt = ctx.system_prompt + "\n\n" + rules
        return GuardrailResult(
            action=GuardrailAction.MODIFY,
            content=modified_prompt,
            reason=f"Appended {self.level} safety rules",
        )
