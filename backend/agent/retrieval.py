"""
Vector retrieval against knowledge_chunks via the match_doc_chunks RPC.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from backend.agent.embeddings import embed_query
from backend.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

DEFAULT_K = 8
DEFAULT_THRESHOLD = 0.5


def retrieve_context(
    query: str,
    filters: Optional[Dict[str, Any]] = None,
    k: int = DEFAULT_K,
    match_threshold: float = DEFAULT_THRESHOLD,
) -> List[Dict[str, Any]]:
    """
    Embed `query`, call match_doc_chunks, return ranked chunks.

    filters may include:
        source_type: str    — restrict to e.g. 'quant_reference'
        ticker: str         — filter on metadata->>ticker
        recency_days: int   — only chunks created in the last N days
    """
    sb = get_service_client()
    if sb is None:
        logger.warning("retrieve_context: Supabase not configured — returning empty.")
        return []

    filters = filters or {}
    embedding = embed_query(query)

    payload: Dict[str, Any] = {
        "query_embedding": embedding,
        "match_threshold": match_threshold,
        "match_count": k,
        "filter_source_type": filters.get("source_type"),
        "filter_ticker": filters.get("ticker"),
        "filter_recency_days": filters.get("recency_days"),
    }

    try:
        res = sb.rpc("match_doc_chunks", payload).execute()
    except Exception as e:
        logger.warning("match_doc_chunks RPC failed: %s", e)
        return []

    rows = res.data or []
    # Normalize: expose `source` + `content` + `similarity` + `metadata`.
    out: List[Dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "id": r.get("id"),
                "source": r.get("source"),
                "content": r.get("content"),
                "similarity": float(r.get("similarity", 0.0) or 0.0),
                "metadata": r.get("metadata") or {},
            }
        )
    return out
