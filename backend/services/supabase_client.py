"""
Service-role Supabase client for backend-authored writes.

Used by:
  - pipeline routes → insert/update `pipeline_runs`
  - market_data → read/write `ohlcv_cache`

Keep the service-role key server-side. Never ship it to the browser.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

from backend.core.config import get_settings

logger = logging.getLogger(__name__)


@lru_cache
def get_service_client() -> Optional[Client]:
    """
    Lazy singleton. Returns None if Supabase env vars aren't configured
    (local dev without DB — market data still works, pipeline history silently
    skipped).
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase URL or service_role_key missing — DB writes disabled.")
        return None
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
