"""
Chat router for AI-powered code hints.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from ..middleware.auth import verify_internal_secret
from ..models.chat import ChatRequest, ChatResponse
from ..services.backend_api import backend_api
from ..services.llm import llm_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post(
    "",
    response_model=ChatResponse,
    dependencies=[Depends(verify_internal_secret)],
    summary="Generate AI hint for student",
    description="Generates helpful hints for students working on coding exercises",
)
async def chat(request: ChatRequest) -> ChatResponse:
    """
    Generate an AI-powered hint for the student.

    This endpoint:
    1. Fetches exercise details from the backend API
    2. Sends student's code and question to the LLM
    3. Returns a helpful hint (not a complete solution)

    Args:
        request: Chat request with exercise_id, code, language, message, user_id

    Returns:
        ChatResponse with AI-generated hint and optional suggestions
    """
    try:
        # Fetch exercise details from backend
        exercise = await backend_api.get_exercise(request.exercise_id)

        # Generate hint using LLM
        hint = await llm_service.generate_hint(
            exercise=exercise, code=request.code, message=request.message
        )

        return ChatResponse(response=hint, suggestions=[])

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log error and return generic message
        print(f"Error generating hint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate hint. Please try again.",
        ) from e
