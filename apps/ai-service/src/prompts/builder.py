"""
Prompt building utilities for constructing system prompts and messages.
"""

from ..models.chat import ChatRequest


def build_system_prompt(request: ChatRequest) -> str:
    """Build the system prompt from request context.

    Args:
        request: The chat request containing all context

    Returns:
        The complete system prompt for the LLM
    """
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


def build_messages(request: ChatRequest) -> list[dict]:
    """Build the messages list from request context.

    Args:
        request: The chat request containing all context

    Returns:
        List of message dictionaries for the LLM
    """
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
