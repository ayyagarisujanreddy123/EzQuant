"""
Health endpoint.

Kept intentionally minimal. In later iterations you'll add deeper checks here
(Supabase reachability, Gemini API reachability, yfinance latency probe).
For now: "the process is up and serving requests."
"""

from datetime import datetime, timezone
from fastapi import APIRouter
from backend.core.config import get_settings
from backend.schemas.market import HealthResponse
router = APIRouter(tags=["health"])

@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(timezone.utc),
        env=settings.app_env,
    )
