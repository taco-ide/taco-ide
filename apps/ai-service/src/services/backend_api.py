"""
HTTP client for calling the backend API.
"""

import httpx
from typing import Any

from ..config import settings
from ..models.exercise import Exercise


class BackendAPIClient:
    """Client for making requests to the backend API."""

    def __init__(self):
        self.base_url = settings.backend_api_url
        self.headers = {"X-Internal-Secret": settings.internal_api_secret}
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self.headers,
            timeout=10.0,
        )

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    async def get_exercise(self, exercise_id: int) -> Exercise:
        """
        Fetch exercise details from backend API.

        Args:
            exercise_id: ID of the exercise to fetch

        Returns:
            Exercise object with details

        Raises:
            httpx.HTTPError: If request fails
        """
        response = await self.client.get(f"/v1/internal/exercises/{exercise_id}")
        response.raise_for_status()

        data = response.json()
        if not data.get("success"):
            raise ValueError(f"API returned error: {data.get('message')}")

        return Exercise(**data["data"])

    async def get_recent_submissions(
        self, exercise_id: int, limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Fetch recent submissions for an exercise.

        Args:
            exercise_id: ID of the exercise
            limit: Maximum number of submissions to fetch

        Returns:
            List of submission dictionaries

        Raises:
            httpx.HTTPError: If request fails
        """
        response = await self.client.get(
            f"/v1/internal/submissions/{exercise_id}/recent",
            params={"limit": str(limit)},
        )
        response.raise_for_status()

        data = response.json()
        if not data.get("success"):
            raise ValueError(f"API returned error: {data.get('message')}")

        return data["data"]


# Global client instance
backend_api = BackendAPIClient()
