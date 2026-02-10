"""
LLM service for generating code hints and analysis.
"""

from openai import AsyncOpenAI

from ..config import settings


class LLMService:
    """Service for interacting with LLM providers."""

    def __init__(self):
        """Initialize LLM client based on available API keys."""
        if settings.openai_api_key:
            self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        else:
            raise ValueError("No LLM API key configured. Set OPENAI_API_KEY.")

    async def generate(self, system_prompt: str, messages: list[dict]) -> str:
        """Generate text from the LLM.

        Args:
            system_prompt: The system prompt for the LLM
            messages: List of message dictionaries with role and content

        Returns:
            The LLM-generated response text
        """
        llm_messages = [{"role": "system", "content": system_prompt}, *messages]

        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=1024,
            messages=llm_messages,
        )
        return response.choices[0].message.content


# Global LLM service instance
llm_service = LLMService()
