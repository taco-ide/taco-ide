"""
Tests for Pydantic models (ChatRequest, ChatResponse, etc.).
"""

import pytest

from src.models.chat import ChatRequest, ChatResponse, ExerciseContext, TeachingAssistantContext


# --- ExerciseContext ---

def test_exercise_parses_camel_case_aliases():
    ex = ExerciseContext.model_validate({
        "title": "Test",
        "supportMaterials": {"hint": "use loops"},
        "possibleSolutions": ["x = 1"],
    })
    assert ex.title == "Test"
    assert ex.support_materials == {"hint": "use loops"}
    assert ex.possible_solutions == ["x = 1"]


def test_exercise_parses_snake_case_field_names():
    ex = ExerciseContext(
        title="Test",
        support_materials={"hint": "use loops"},
        possible_solutions=["x = 1"],
    )
    assert ex.support_materials == {"hint": "use loops"}


def test_exercise_defaults_to_none():
    ex = ExerciseContext(title="Test")
    assert ex.description is None
    assert ex.support_materials is None
    assert ex.possible_solutions is None


# --- TeachingAssistantContext ---

def test_ta_parses_camel_case_aliases():
    ta = TeachingAssistantContext.model_validate({
        "systemPrompt": "You are a tutor.",
        "targetAudience": "Beginner",
    })
    assert ta.system_prompt == "You are a tutor."
    assert ta.target_audience == "Beginner"


def test_ta_parses_snake_case():
    ta = TeachingAssistantContext(system_prompt="You are a tutor.", target_audience="Beginner")
    assert ta.system_prompt == "You are a tutor."


# --- ChatRequest ---

def test_chat_request_parses_camel_case_json():
    data = {
        "code": "pass",
        "language": "python",
        "message": "help",
        "exercise": {"title": "Test"},
        "teachingAssistant": {"systemPrompt": "Be helpful."},
        "knowledgeBase": ["doc entry"],
        "chatHistory": [{"role": "user", "content": "hi"}],
        "guardrailPreset": "strict",
    }
    req = ChatRequest.model_validate(data)
    assert req.code == "pass"
    assert req.teaching_assistant.system_prompt == "Be helpful."
    assert req.knowledge_base == ["doc entry"]
    assert len(req.chat_history) == 1
    assert req.guardrail_preset == "strict"


def test_chat_request_defaults():
    req = ChatRequest(
        code="pass",
        language="python",
        message="help",
        exercise=ExerciseContext(title="Test"),
        teaching_assistant=TeachingAssistantContext(system_prompt="Be helpful."),
    )
    assert req.knowledge_base == []
    assert req.chat_history == []
    assert req.guardrail_preset == "medium"


# --- ChatResponse ---

def test_chat_response_defaults():
    resp = ChatResponse(response="Hello!")
    assert resp.response == "Hello!"
    assert resp.suggestions == []
    assert resp.guardrail_blocked is False
    assert resp.guardrail_log == []


def test_chat_response_serializes_camel_case():
    resp = ChatResponse(
        response="Hello!",
        guardrail_blocked=True,
        guardrail_log=["[before] PromptInjection: block"],
    )
    data = resp.model_dump(by_alias=True)
    assert data["guardrailBlocked"] is True
    assert data["guardrailLog"] == ["[before] PromptInjection: block"]
