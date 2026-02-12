"""
LLM service for generating code hints and analysis.
"""

from openai import AsyncOpenAI, APIError, BadRequestError

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

        Raises:
            ValueError: If message format is invalid
            APIError: If the LLM API returns an error
        """
        # Validate message format before sending to LLM
        for i, msg in enumerate(messages):
            if "role" not in msg or "content" not in msg:
                raise ValueError(
                    f"Message at index {i} is missing required fields. "
                    f"Each message must have 'role' and 'content' fields."
                )
            if msg["role"] not in ["user", "assistant", "system"]:
                raise ValueError(
                    f"Message at index {i} has invalid role '{msg['role']}'. "
                    f"Valid roles are: 'user', 'assistant', 'system'"
                )

        llm_messages = [{"role": "system", "content": system_prompt}, *messages]

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                messages=llm_messages,
            )
            return response.choices[0].message.content
        except BadRequestError as e:
            # Extract error message from OpenAI error response
            error_msg = str(e)
            if "messages" in error_msg.lower() and "role" in error_msg.lower():
                raise ValueError(
                    "Invalid message format in chat history. Each message must have a 'role' field "
                    "with value 'user' or 'assistant', and a 'content' field with the message text."
                ) from e
            raise ValueError(f"Invalid request to LLM API: {error_msg}") from e
        except APIError as e:
            raise APIError(f"LLM API error: {str(e)}") from e


# Global LLM service instance
llm_service = LLMService()
