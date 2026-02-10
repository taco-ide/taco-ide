"""
Tests for prompt builder functions.
"""

import pytest

from src.models.chat import ChatMessage, ChatRequest, ExerciseContext, TeachingAssistantContext
from src.prompts.builder import build_messages, build_system_prompt


@pytest.fixture
def base_request():
    return ChatRequest(
        code="def add(a, b):\n    pass",
        language="python",
        message="How do I return the sum?",
        exercise=ExerciseContext(
            title="Add Two Numbers",
            description="Write a function that adds two numbers",
        ),
        teaching_assistant=TeachingAssistantContext(
            system_prompt="You are a helpful Python tutor.",
            target_audience="Beginner",
        ),
        knowledge_base=[],
        chat_history=[],
    )


# --- build_system_prompt ---

def test_system_prompt_starts_with_ta_prompt(base_request):
    result = build_system_prompt(base_request)
    assert result.startswith("You are a helpful Python tutor.")


def test_system_prompt_includes_exercise_title(base_request):
    result = build_system_prompt(base_request)
    assert "Add Two Numbers" in result


def test_system_prompt_includes_description(base_request):
    result = build_system_prompt(base_request)
    assert "Write a function that adds two numbers" in result


def test_system_prompt_omits_description_when_none(base_request):
    base_request.exercise.description = None
    result = build_system_prompt(base_request)
    assert "Description" not in result


def test_system_prompt_includes_knowledge_base(base_request):
    base_request.knowledge_base = ["Python uses def for functions.", "return exits a function."]
    result = build_system_prompt(base_request)
    assert "REFERENCE MATERIALS" in result
    assert "Python uses def for functions." in result
    assert "return exits a function." in result


def test_system_prompt_omits_reference_materials_when_empty(base_request):
    base_request.knowledge_base = []
    result = build_system_prompt(base_request)
    assert "REFERENCE MATERIALS" not in result


# --- build_messages ---

def test_build_messages_includes_current_message(base_request):
    messages = build_messages(base_request)
    last = messages[-1]
    assert last["role"] == "user"
    assert "How do I return the sum?" in last["content"]


def test_build_messages_includes_student_code(base_request):
    messages = build_messages(base_request)
    last = messages[-1]
    assert "def add(a, b):" in last["content"]


def test_build_messages_without_history_returns_one_message(base_request):
    base_request.chat_history = []
    messages = build_messages(base_request)
    assert len(messages) == 1


def test_build_messages_with_history_includes_history(base_request):
    base_request.chat_history = [
        ChatMessage(role="user", content="What is a function?"),
        ChatMessage(role="assistant", content="A function is a reusable block of code."),
    ]
    messages = build_messages(base_request)
    assert len(messages) == 3
    assert messages[0] == {"role": "user", "content": "What is a function?"}
    assert messages[1] == {"role": "assistant", "content": "A function is a reusable block of code."}
