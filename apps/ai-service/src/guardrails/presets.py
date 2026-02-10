"""
Preset configurations for guardrail chains.
"""

from .chain import GuardrailChain
from .code_detector import CodeDetectorGuardrail
from .prompt_injection import PromptInjectionGuardrail
from .prompt_rules import PromptRulesGuardrail
from .pseudocode_detector import PseudocodeDetectorGuardrail


# Guardrail presets for different strictness levels
LOOSE_RULES = GuardrailChain(
    before_llm=[
        PromptInjectionGuardrail(),
        PromptRulesGuardrail("loose"),
    ],
    after_llm=[
        CodeDetectorGuardrail(),
    ],
)

MEDIUM_RULES = GuardrailChain(
    before_llm=[
        PromptInjectionGuardrail(),
        PromptRulesGuardrail("medium"),
    ],
    after_llm=[
        CodeDetectorGuardrail(),
    ],
)

STRICT_RULES = GuardrailChain(
    before_llm=[
        PromptInjectionGuardrail(),
        PromptRulesGuardrail("strict"),
    ],
    after_llm=[
        CodeDetectorGuardrail(),
        PseudocodeDetectorGuardrail(),
    ],
)


def build_preset(preset_id: str) -> GuardrailChain:
    """Build a guardrail preset by ID.

    Args:
        preset_id: One of "loose", "medium", or "strict"

    Returns:
        GuardrailChain configured for the preset

    Raises:
        ValueError: If preset_id is not recognized
    """
    presets = {
        "loose": LOOSE_RULES,
        "medium": MEDIUM_RULES,
        "strict": STRICT_RULES,
    }

    if preset_id not in presets:
        raise ValueError(f"Unknown preset: {preset_id}. Must be one of {list(presets.keys())}")

    return presets[preset_id]
