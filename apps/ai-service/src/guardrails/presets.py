"""
Preset configurations for guardrail chains.
"""

from .chain import GuardrailChain
from .code_detector import CodeDetectorGuardrail
from .prompt_injection import PromptInjectionGuardrail
from .prompt_rules import PromptRulesGuardrail
from .pseudocode_detector import PseudocodeDetectorGuardrail

_VALID_PRESETS = {"loose", "medium", "strict"}


def build_preset(preset_id: str) -> GuardrailChain:
    """Build a guardrail preset by ID with fresh instances per call.

    Args:
        preset_id: One of "loose", "medium", or "strict"

    Returns:
        A new GuardrailChain configured for the preset

    Raises:
        ValueError: If preset_id is not recognized
    """
    if preset_id not in _VALID_PRESETS:
        raise ValueError(f"Unknown preset: '{preset_id}'. Must be one of {sorted(_VALID_PRESETS)}")

    if preset_id == "loose":
        return GuardrailChain(
            before_llm=[
                PromptInjectionGuardrail(),
                PromptRulesGuardrail("loose"),
            ],
            after_llm=[
                CodeDetectorGuardrail(),
            ],
        )

    if preset_id == "medium":
        return GuardrailChain(
            before_llm=[
                PromptInjectionGuardrail(),
                PromptRulesGuardrail("medium"),
            ],
            after_llm=[
                CodeDetectorGuardrail(),
            ],
        )

    # strict
    return GuardrailChain(
        before_llm=[
            PromptInjectionGuardrail(),
            PromptRulesGuardrail("strict"),
        ],
        after_llm=[
            CodeDetectorGuardrail(),
            PseudocodeDetectorGuardrail(),
        ],
    )
