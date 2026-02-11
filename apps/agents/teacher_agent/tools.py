from google.adk.tools import ToolContext

from shared.db import get_pool


async def create_challenge_draft(
    title: str,
    description: str,
    difficulty: str,
    test_cases: list[dict],
    solution: str,
    tool_context: ToolContext,
) -> dict:
    """Create a draft challenge that can be reviewed by the teacher.

    The draft is stored in session state. The teacher can review and confirm
    it through the frontend, which will then persist it to the database.

    Args:
        title: The challenge title.
        description: The challenge description with problem statement.
        difficulty: The difficulty level (easy, medium, hard).
        test_cases: A list of test cases, each with input and expected_output.
        solution: A reference solution in Python.
        tool_context: ADK tool context for session state access.

    Returns:
        A dict confirming the draft was created with its details.
    """
    draft = {
        "title": title,
        "description": description,
        "difficulty": difficulty,
        "test_cases": test_cases,
        "solution": solution,
    }
    tool_context.state["challenge_draft"] = draft
    return {
        "status": "draft_created",
        "draft": draft,
    }


async def list_submissions(challenge_id: str, tool_context: ToolContext) -> dict:
    """List student submissions for a given challenge.

    Queries the database for challenge solutions and recent interactions.

    Args:
        challenge_id: The ID of the challenge to list submissions for.
        tool_context: ADK tool context for session state access.

    Returns:
        A dict with the list of submissions including student info and code.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
                cs.id,
                cs.user_id,
                u.name AS student_name,
                cs.code,
                cs.stdout,
                cs.updated_at
            FROM challenge_solution cs
            JOIN "user" u ON u.id = cs.user_id
            WHERE cs.challenge_id = $1
            ORDER BY cs.updated_at DESC
            LIMIT 50
            """,
            challenge_id,
        )
    return {
        "submissions": [
            {
                "id": row["id"],
                "student_name": row["student_name"],
                "code": row["code"],
                "stdout": row["stdout"],
                "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
            }
            for row in rows
        ],
    }


async def evaluate_submission(submission_id: str, tool_context: ToolContext) -> dict:
    """Load a student submission and its interaction history for evaluation.

    Retrieves the student's code, execution output, and chat history to
    provide the teacher with a comprehensive view for evaluation.

    Args:
        submission_id: The ID of the challenge_solution to evaluate.
        tool_context: ADK tool context for session state access.

    Returns:
        A dict with the submission details and interaction history.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        solution = await conn.fetchrow(
            """
            SELECT
                cs.id,
                cs.user_id,
                u.name AS student_name,
                cs.code,
                cs.stdout,
                cs.chat_history,
                cs.challenge_id
            FROM challenge_solution cs
            JOIN "user" u ON u.id = cs.user_id
            WHERE cs.id = $1
            """,
            submission_id,
        )
        if not solution:
            return {"error": "Submission not found"}

        interactions = await conn.fetch(
            """
            SELECT user_prompt, model_response, code, stdout, created_at
            FROM user_interaction_on_challenge
            WHERE challenge_id = $1
            ORDER BY created_at ASC
            LIMIT 100
            """,
            solution["challenge_id"],
        )

    return {
        "submission": {
            "id": solution["id"],
            "student_name": solution["student_name"],
            "code": solution["code"],
            "stdout": solution["stdout"],
        },
        "interactions": [
            {
                "user_prompt": row["user_prompt"],
                "model_response": row["model_response"],
                "code": row["code"],
                "stdout": row["stdout"],
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            }
            for row in interactions
        ],
    }


async def suggest_test_cases(
    problem_description: str,
    solution: str,
    tool_context: ToolContext,
) -> dict:
    """Suggest test cases for a challenge based on the problem and solution.

    This is a reasoning-only tool. It returns the problem context so the LLM
    can generate appropriate test cases using its own reasoning capabilities.

    Args:
        problem_description: The challenge problem description.
        solution: The reference solution code.
        tool_context: ADK tool context for session state access.

    Returns:
        A dict with the problem context for the LLM to reason about test cases.
    """
    return {
        "instruction": (
            "Based on the problem description and reference solution below, "
            "suggest comprehensive test cases covering: edge cases, boundary "
            "values, typical inputs, and error cases."
        ),
        "problem_description": problem_description,
        "solution": solution,
    }


async def get_classroom_info(tool_context: ToolContext) -> dict:
    """Retrieve the current classroom information from the session state.

    Returns:
        A dict with the classroom ID, name, and description.
    """
    state = tool_context.state
    return {
        "classroom_id": state.get("classroom_id", ""),
        "classroom_name": state.get("classroom_name", ""),
        "classroom_description": state.get("classroom_description", ""),
    }
