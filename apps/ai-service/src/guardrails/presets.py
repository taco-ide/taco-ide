"""
Preset configurations for guardrail chains.
"""

from ..models.chat import GuardrailConfig
from .chain import GuardrailChain
from .code_detector import CodeDetectorGuardrail
from .output_length import OutputLengthGuardrail
from .prompt_injection import PromptInjectionGuardrail
from .prompt_rules import PromptRulesGuardrail
from .pseudocode_detector import PseudocodeDetectorGuardrail
from .token_limit import TokenLimitGuardrail

_VALID_PRESETS = {"loose", "medium", "strict"}


def build_preset(preset_id: str, config: GuardrailConfig | None = None) -> GuardrailChain:
    """Build a guardrail chain from a preset, with optional per-TA config overrides.

    Args:
        preset_id: Base preset name ("loose", "medium", or "strict")
        config: Optional per-TA config overrides

    Returns:
        A configured GuardrailChain

    Raises:
        ValueError: If preset_id is not recognized
    """
    if preset_id not in _VALID_PRESETS:
        raise ValueError(f"Unknown preset: '{preset_id}'. Must be one of {sorted(_VALID_PRESETS)}")

    # Build base chain from preset
    if preset_id == "loose":
        chain = GuardrailChain(
            before_llm=[
                PromptInjectionGuardrail(),
                PromptRulesGuardrail("loose"),
            ],
            after_llm=[
                CodeDetectorGuardrail(),
            ],
        )
    elif preset_id == "medium":
        chain = GuardrailChain(
            before_llm=[
                PromptInjectionGuardrail(),
                PromptRulesGuardrail("medium"),
            ],
            after_llm=[
                CodeDetectorGuardrail(),
            ],
        )
    else:  # strict
        chain = GuardrailChain(
            before_llm=[
                PromptInjectionGuardrail(),
                PromptRulesGuardrail("strict"),
            ],
            after_llm=[
                CodeDetectorGuardrail(),
                PseudocodeDetectorGuardrail(),
            ],
        )

    # Apply per-TA config overrides if provided
    if config is None:
        return chain

    # Token limit overrides (before-LLM)
    if config.max_input_tokens is not None:
        chain.before_llm.insert(0, TokenLimitGuardrail(config.max_input_tokens))

    # Code detector override (after-LLM)
    if config.block_code is False:
        chain.after_llm = [g for g in chain.after_llm if not isinstance(g, CodeDetectorGuardrail)]
    elif config.block_code is True:
        if not any(isinstance(g, CodeDetectorGuardrail) for g in chain.after_llm):
            chain.after_llm.append(CodeDetectorGuardrail())

    # Pseudocode detector override (after-LLM)
    if config.block_pseudocode is False:
        chain.after_llm = [g for g in chain.after_llm if not isinstance(g, PseudocodeDetectorGuardrail)]
    elif config.block_pseudocode is True:
        if not any(isinstance(g, PseudocodeDetectorGuardrail) for g in chain.after_llm):
            chain.after_llm.append(PseudocodeDetectorGuardrail())

    # Output length override (after-LLM)
    if config.max_output_tokens is not None:
        chain.after_llm.append(OutputLengthGuardrail(config.max_output_tokens))

    return chain
