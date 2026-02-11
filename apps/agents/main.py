import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService

from shared.config import settings
from shared.db import close_pool
from student_agent.agent import root_agent as student_agent
from teacher_agent.agent import root_agent as teacher_agent


session_service = InMemorySessionService()

student_runner = Runner(
    agent=student_agent,
    app_name="taco_student",
    session_service=session_service,
)

teacher_runner = Runner(
    agent=teacher_agent,
    app_name="taco_teacher",
    session_service=session_service,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()


app = FastAPI(title="TACO-IDE Agents", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "agents": ["student_tutor", "teacher_assistant"]}


async def _run_agent_sse(runner: Runner, request: Request):
    """Run an agent and stream SSE events back to the caller."""
    body = await request.json()

    session_id = body.get("session_id", "default")
    user_id = body.get("user_id", "anonymous")
    message = body.get("message", "")
    state = body.get("state", {})

    # Create or retrieve session, updating state
    session = await session_service.get_session(
        app_name=runner.app_name,
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        session = await session_service.create_session(
            app_name=runner.app_name,
            user_id=user_id,
            session_id=session_id,
            state=state,
        )
    else:
        # Update session state with latest context from Fastify
        session.state.update(state)

    from google.genai.types import Content, Part

    user_content = Content(role="user", parts=[Part(text=message)])

    async def event_generator():
        full_response = ""
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=user_content,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        full_response += part.text
                        sse_data = json.dumps({
                            "type": "text",
                            "content": part.text,
                            "author": event.author,
                        })
                        yield f"data: {sse_data}\n\n"
                    elif part.function_call:
                        sse_data = json.dumps({
                            "type": "tool_call",
                            "tool": part.function_call.name,
                            "args": dict(part.function_call.args) if part.function_call.args else {},
                        })
                        yield f"data: {sse_data}\n\n"
                    elif part.function_response:
                        sse_data = json.dumps({
                            "type": "tool_result",
                            "tool": part.function_response.name,
                        })
                        yield f"data: {sse_data}\n\n"

        # Send done event with the full accumulated response
        done_data = json.dumps({
            "type": "done",
            "full_response": full_response,
        })
        yield f"data: {done_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/student/run_sse")
async def student_run_sse(request: Request):
    return await _run_agent_sse(student_runner, request)


@app.post("/teacher/run_sse")
async def teacher_run_sse(request: Request):
    return await _run_agent_sse(teacher_runner, request)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.AGENT_PORT)
