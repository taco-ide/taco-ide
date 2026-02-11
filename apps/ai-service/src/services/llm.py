"""
LLM service for generating code hints and analysis.
"""

from openai import AsyncOpenAI

from ..config import settings


class LLMService:
    """Service for interacting with LLM providers."""

    def __init__(self) -> None:
        """Initialize LLM client based on available API keys and configuration.

        Raises:
            ValueError: If no LLM API key is configured.
        """
        if settings.openai_api_key:
            self.client = AsyncOpenAI(
                api_key=settings.openai_api_key,
                base_url=settings.llm_base_url,
            )
            self.model = settings.llm_model
            self.max_tokens = settings.llm_max_tokens
            self.temperature = settings.llm_temperature
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
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            messages=llm_messages,
        )
        return response.choices[0].message.content


# Global LLM service instance
llm_service = LLMService()
