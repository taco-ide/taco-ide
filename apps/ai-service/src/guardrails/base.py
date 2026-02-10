"""
Base types for the guardrails chain system.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum


class GuardrailAction(Enum):
    """Action a guardrail can take."""

    ALLOW = "allow"
    MODIFY = "modify"
    BLOCK = "block"


@dataclass
class GuardrailResult:
    """Result returned by a guardrail execution."""

    action: GuardrailAction
    content: str | None = None
    reason: str | None = None


@dataclass
class GuardrailContext:
    """Shared mutable state flowing through the guardrail chain."""

    student_message: str
    student_code: str
    language: str
    system_prompt: str
    llm_response: str = ""
    log: list[str] = field(default_factory=list)


class Guardrail(ABC):
    """Abstract base class for guardrails."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name for this guardrail."""
        ...

    @abstractmethod
    async def execute(self, ctx: GuardrailContext) -> GuardrailResult:
        """Execute the guardrail against the current context."""
        ...
