"""
Chat router for AI-powered code hints.
"""

from fastapi import APIRouter, HTTPException, status

from ..models.chat import ChatRequest, ChatResponse
from ..services.llm import llm_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post(
    "",
    response_model=ChatResponse,
    summary="Generate AI hint for student",
    description="Generates helpful hints for students working on coding exercises",
)
async def chat(request: ChatRequest) -> ChatResponse:
    try:
        hint = await llm_service.generate_hint(request)
        return ChatResponse(response=hint, suggestions=[])
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating hint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate hint. Please try again.",
        ) from e
