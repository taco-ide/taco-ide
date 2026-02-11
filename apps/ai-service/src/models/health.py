"""
Health check response model.
"""

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""

    model_config = ConfigDict(populate_by_name=True)

    status: str = Field(..., description="Health status")
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")
    llm_model: str = Field(..., alias="llmModel", description="Configured LLM model")
    llm_base_url: str = Field(
        ..., alias="llmBaseUrl", description="Configured LLM base URL"
    )
