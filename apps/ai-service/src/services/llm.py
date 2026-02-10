"""
LLM service for generating code hints and analysis.
"""

from anthropic import AsyncAnthropic

from ..config import settings
from ..models.chat import ChatRequest


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

    async def generate_hint(self, request: ChatRequest) -> str:
        system_prompt = self._build_system_prompt(request)
        messages = self._build_messages(request)

        if self.provider == "anthropic":
            response = await self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            )
            return response.content[0].text

        raise NotImplementedError(f"Provider {self.provider} not implemented")

    def _build_system_prompt(self, request: ChatRequest) -> str:
        ta = request.teaching_assistant
        exercise = request.exercise

        # Start with the TA's own system prompt
        prompt = ta.system_prompt

        # Append exercise context
        prompt += f"\n\nEXERCISE CONTEXT:\nTitle: {exercise.title}"
        if exercise.description:
            prompt += f"\nDescription: {exercise.description}"

        # Append knowledge base if available
        if request.knowledge_base:
            prompt += "\n\nREFERENCE MATERIALS:\n"
            for i, entry in enumerate(request.knowledge_base, 1):
                prompt += f"\n--- Reference {i} ---\n{entry}\n"

        return prompt

    def _build_messages(self, request: ChatRequest) -> list[dict]:
        messages = []

        # Add chat history
        for msg in request.chat_history:
            messages.append({"role": msg.role, "content": msg.content})

        # Add current user message with code context
        user_message = f"""STUDENT'S CURRENT CODE:
```{request.language}
{request.code}
```

STUDENT'S QUESTION:
{request.message}

Please provide a helpful hint or guidance."""

        messages.append({"role": "user", "content": user_message})
        return messages


# Global LLM service instance
llm_service = LLMService()
