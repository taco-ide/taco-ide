"""
Exercise model for data fetched from backend API.
"""

from pydantic import BaseModel, Field


class TestCase(BaseModel):
    """Test case for an exercise."""

    input: str
    expectedOutput: str


class Exercise(BaseModel):
    """Exercise data fetched from backend API."""

    id: int
    title: str
    description: str
    initialCode: str = Field(..., alias="initialCode")
    difficulty: str  # "EASY", "MEDIUM", "HARD"
    testCases: list[TestCase] = Field(default_factory=list, alias="testCases")

    class Config:
        populate_by_name = True
