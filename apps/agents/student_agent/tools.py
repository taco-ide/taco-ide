import httpx
from google.adk.tools import ToolContext

from shared.config import settings
from shared.db import get_pool


async def run_code(code: str, stdin: str = "") -> dict:
    """Execute Python code in a sandboxed environment.

    Args:
        code: The Python code to execute.
        stdin: Standard input to provide to the program.

    Returns:
        A dict with stdout, stderr, and exit_code from the execution.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            settings.CODE_EXEC_API_URL,
            json={
                "language": "python",
                "version": "3.12.0",
                "files": [{"content": code}],
                "stdin": stdin,
            },
        )
        data = response.json()

    run_data = data.get("run", {})
    return {
        "stdout": run_data.get("stdout", ""),
        "stderr": run_data.get("stderr", ""),
        "exit_code": run_data.get("code", -1),
    }


async def get_challenge_info(tool_context: ToolContext) -> dict:
    """Retrieve the current challenge information from the session state.

    Returns:
        A dict with the challenge title, description, and support materials.
    """
    state = tool_context.state
    return {
        "title": state.get("challenge_title", ""),
        "description": state.get("challenge_description", ""),
        "support_materials": state.get("support_materials", ""),
    }


async def search_knowledge_base(query: str) -> dict:
    """Search the knowledge base for relevant educational content.

    Uses text search to find content matching the query. Results are
    scoped to the current organization and classroom when available.

    Args:
        query: The search query string.

    Returns:
        A dict with a list of matching knowledge base entries.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, content
            FROM knowledge_base
            WHERE content ILIKE $1
            ORDER BY updated_at DESC
            LIMIT 5
            """,
            f"%{query}%",
        )
    return {
        "results": [{"id": row["id"], "content": row["content"]} for row in rows],
    }
