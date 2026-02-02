"""
LLM service for generating code hints and analysis.
"""

from anthropic import Anthropic

from ..config import settings
from ..models.exercise import Exercise


class LLMService:
    """Service for interacting with LLM providers."""

    def __init__(self):
        """Initialize LLM client based on available API keys."""
        if settings.anthropic_api_key:
            self.client = Anthropic(api_key=settings.anthropic_api_key)
            self.provider = "anthropic"
        elif settings.openai_api_key:
            # TODO: Implement OpenAI client when needed
            raise NotImplementedError("OpenAI support not yet implemented")
        else:
            raise ValueError(
                "No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY"
            )

    async def generate_hint(
        self, exercise: Exercise, code: str, message: str
    ) -> str:
        """
        Generate a helpful hint for the student.

        Args:
            exercise: The exercise being worked on
            code: Student's current code
            message: Student's question or request

        Returns:
            AI-generated hint as a string

        Guidelines:
            - Provide hints, not complete solutions
            - Guide the student's thinking process
            - Point out errors or issues without fixing them directly
            - Encourage learning through discovery
        """
        system_prompt = self._build_system_prompt(exercise)
        user_message = self._build_user_message(code, message)

        if self.provider == "anthropic":
            response = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            return response.content[0].text

        raise NotImplementedError(f"Provider {self.provider} not implemented")

    def _build_system_prompt(self, exercise: Exercise) -> str:
        """Build the system prompt with exercise context."""
        return f"""You are a helpful programming tutor for students learning to code.

EXERCISE CONTEXT:
Title: {exercise.title}
Description: {exercise.description}
Difficulty: {exercise.difficulty}

GUIDELINES:
1. Provide hints and guidance, NOT complete solutions
2. Help students discover answers through questioning
3. Point out errors without directly fixing them
4. Encourage good programming practices
5. Be supportive and patient
6. Use simple, clear language
7. If the student asks for the answer directly, gently redirect them to think through the problem

Your goal is to help the student learn by guiding their thinking process."""

    def _build_user_message(self, code: str, message: str) -> str:
        """Build the user message with code and question."""
        return f"""STUDENT'S CURRENT CODE:
```python
{code}
```

STUDENT'S QUESTION:
{message}

Please provide a helpful hint or guidance."""


# Global LLM service instance
llm_service = LLMService()
