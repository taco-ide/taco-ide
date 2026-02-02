"""
Authentication middleware for internal service-to-service requests.
"""

from fastapi import Header, HTTPException, status

from ..config import settings


async def verify_internal_secret(x_internal_secret: str = Header(...)) -> None:
    """
    Verify that the request contains the correct internal secret.

    Args:
        x_internal_secret: Secret from X-Internal-Secret header

    Raises:
        HTTPException: If secret is invalid
    """
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal secret",
        )
