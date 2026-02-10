"""
Chat router for AI-powered code hints.
"""

from fastapi import APIRouter, HTTPException, status

from ..guardrails import GuardrailContext, build_preset
from ..models.chat import ChatRequest, ChatResponse
from ..prompts import build_messages, build_system_prompt
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
        # Build prompt and messages from request
        system_prompt = build_system_prompt(request)
        messages = build_messages(request)

        # Create guardrail context
        ctx = GuardrailContext(
            student_message=request.message,
            student_code=request.code,
            language=request.language,
            system_prompt=system_prompt,
            llm_response="",
            log=[],
        )

        # Build and run before-LLM guardrails
        preset = build_preset(request.guardrail_preset)
        before_result = await preset.run_before(ctx)

        # If a guardrail blocked, return blocked response
        if before_result is not None:
            return ChatResponse(
                response="Your request was blocked by safety guardrails. Please rephrase and try again.",
                suggestions=[],
                guardrail_blocked=True,
                guardrail_log=ctx.log,
            )

        # Call LLM with modified system prompt
        hint = await llm_service.generate(ctx.system_prompt, messages)
        ctx.llm_response = hint

        # Run after-LLM guardrails
        after_result = await preset.run_after(ctx)

        # If a guardrail blocked the response, return fallback
        if after_result is not None:
            return ChatResponse(
                response="I apologize, but I cannot provide that response. Please ask another question.",
                suggestions=[],
                guardrail_blocked=True,
                guardrail_log=ctx.log,
            )

        # Return successful response with guardrail log
        return ChatResponse(
            response=ctx.llm_response,
            suggestions=[],
            guardrail_blocked=False,
            guardrail_log=ctx.log,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating hint: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate hint. Please try again.",
        ) from e
