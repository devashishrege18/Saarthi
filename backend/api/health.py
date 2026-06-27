"""
Health Check Endpoint
"""

from fastapi import APIRouter
from models import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Service health check."""
    return HealthResponse()
