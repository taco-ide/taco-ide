"""
LLM service for generating code hints and analysis.
"""

from anthropic import AsyncAnthropic

from ..config import settings


class LLMService:
    """Service for interacting with LLM providers."""

    def __init__(self):
        """Initialize LLM client based on available API keys."""
        if settings.anthropic_api_key:
            self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            self.provider = "anthropic"
        elif settings.openai_api_key:
            raise NotImplementedError("OpenAI support not yet implemented")
        else:
            raise ValueError("No LLM API key configured.")

    async def generate(self, system_prompt: str, messages: list[dict]) -> str:
        """Generate text from the LLM.

        Args:
            system_prompt: The system prompt for the LLM
            messages: List of message dictionaries with role and content

        Returns:
            The LLM-generated response text
        """
        if self.provider == "anthropic":
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            )
            return response.content[0].text

        raise NotImplementedError(f"Provider {self.provider} not implemented")


# Global LLM service instance
llm_service = LLMService()
