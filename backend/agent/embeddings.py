"""
Gemini embeddings (gemini-embedding-001, 768-dim output).

Task types MUST differ between ingestion (RETRIEVAL_DOCUMENT) and query
(RETRIEVAL_QUERY) — same type on both sides silently degrades recall.

Rate limiting + retry: Gemini embedding has tight RPM caps on the free tier
(~100 RPM). We throttle at ~90 RPM and retry with exponential backoff on 429.
"""
from __future__ import annotations

import logging
import random
import time
from typing import List, Optional

import google.generativeai as genai
from google.api_core import exceptions as gexc

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_CONFIGURED = False
EMBED_DIM = 768

# Paid tier — no throttle. Retry remains for transient 429/5xx.
_MIN_INTERVAL_SEC = 0.0
_LAST_CALL_AT: float = 0.0

_MAX_RETRIES = 5
_BASE_BACKOFF_SEC = 2.0


def _configure() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    settings = get_settings()
    if not settings.google_api_key:
        raise RuntimeError(
            "GOOGLE_API_KEY is not set — cannot embed. Add it to .env.local."
        )
    genai.configure(api_key=settings.google_api_key)
    _CONFIGURED = True


def _resolve_model() -> str:
    model = get_settings().gemini_embedding_model or "gemini-embedding-001"
    if model in {"text-embedding-004", "embedding-001"}:
        model = "gemini-embedding-001"
    return model if model.startswith("models/") else f"models/{model}"


def _throttle() -> None:
    global _LAST_CALL_AT
    now = time.monotonic()
    delta = now - _LAST_CALL_AT
    if delta < _MIN_INTERVAL_SEC:
        time.sleep(_MIN_INTERVAL_SEC - delta)
    _LAST_CALL_AT = time.monotonic()


def _embed_once(model: str, text: str, task_type: str) -> List[float]:
    _throttle()
    last_exc: Optional[Exception] = None
    for attempt in range(_MAX_RETRIES):
        try:
            res = genai.embed_content(
                model=model,
                content=text,
                task_type=task_type,
                output_dimensionality=EMBED_DIM,
            )
            return list(res["embedding"] if isinstance(res, dict) else res.embedding)
        except gexc.ResourceExhausted as e:
            # 429 — back off with jitter.
            last_exc = e
            wait = _BASE_BACKOFF_SEC * (2 ** attempt) + random.uniform(0, 1.5)
            wait = min(wait, 120)
            logger.warning(
                "Embed 429 (attempt %d/%d) — sleeping %.1fs",
                attempt + 1, _MAX_RETRIES, wait,
            )
            time.sleep(wait)
        except Exception as e:
            last_exc = e
            # Transient gRPC errors → short retry.
            logger.warning("Embed error: %s — retry in 4s", e)
            time.sleep(4)
    raise RuntimeError(f"embed_content gave up after {_MAX_RETRIES} tries: {last_exc}")


def embed_document(texts: List[str]) -> List[List[float]]:
    """Embed chunks for storage. task_type='RETRIEVAL_DOCUMENT'."""
    _configure()
    if not texts:
        return []
    model = _resolve_model()
    out: List[List[float]] = []
    total = len(texts)
    for i, text in enumerate(texts, start=1):
        if not text or not text.strip():
            out.append([0.0] * EMBED_DIM)
            continue
        out.append(_embed_once(model, text, "RETRIEVAL_DOCUMENT"))
        if i % 25 == 0 or i == total:
            logger.info("embed_document %d/%d", i, total)
    return out


def embed_query(query: str) -> List[float]:
    """Embed a single user query. task_type='RETRIEVAL_QUERY'."""
    _configure()
    if not query or not query.strip():
        raise ValueError("embed_query: empty query")
    return _embed_once(_resolve_model(), query, "RETRIEVAL_QUERY")
