"""
Pipeline execution routes.

  POST /api/pipeline/run        — execute a pipeline, optionally up to a node.
  GET  /api/pipeline/runs/{id}  — fetch a persisted run by id (for polling).

Auth: every endpoint requires a valid Supabase JWT in Authorization header.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from backend.auth import verify_jwt
from backend.schemas.pipeline import RunRequest, RunResponse
from backend.services.pipeline_runner import execute_pipeline
from backend.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


@router.post("/run", response_model=RunResponse)
def run_pipeline(
    req: RunRequest,
    user_id: str = Depends(verify_jwt),
) -> RunResponse:
    """
    Execute the submitted pipeline. Returns per-node statuses + results.

    If `persist=True` and `run_to` is None (a full Run), a row is inserted
    into public.pipeline_runs with graph_snapshot + node_results so history
    can be polled later. Evaluate runs (run_to set, persist=False) are
    ephemeral — nothing is written to the DB.
    """
    result = execute_pipeline(req.pipeline, run_to=req.run_to)

    if req.persist and req.run_to is None:
        run_id = _persist_run(user_id=user_id, request=req, response=result)
        if run_id:
            result.run_id = run_id

    return result


@router.get("/runs/{run_id}", response_model=RunResponse)
def get_run(run_id: str, user_id: str = Depends(verify_jwt)) -> RunResponse:
    """Fetch a persisted run (polling endpoint)."""
    sb = get_service_client()
    if sb is None:
        raise HTTPException(status_code=503, detail="Run history unavailable (DB not configured).")

    row = (
        sb.table("pipeline_runs")
        .select("*")
        .eq("id", run_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found.")

    node_results = row.data.get("node_results") or {}
    statuses = {nid: nr.get("status", "idle") for nid, nr in node_results.items()}

    return RunResponse(
        run_id=row.data["id"],
        status=row.data.get("status", "success"),
        statuses=statuses,
        node_results=node_results,
        errors={},
        started_at=row.data.get("started_at") or datetime.now(timezone.utc),
        completed_at=row.data.get("completed_at"),
        summary=row.data.get("summary"),
    )


# ─── Persistence helper ──────────────────────────────────────────────────────


def _persist_run(user_id: str, request: RunRequest, response: RunResponse) -> str | None:
    """
    Insert a pipeline_runs row. Returns the generated id, or None if DB is
    unavailable. Failures here must not break the HTTP response.
    """
    sb = get_service_client()
    if sb is None:
        return None

    try:
        row = {
            "user_id": user_id,
            "project_id": request.project_id,
            "status": response.status,
            "graph_snapshot": request.pipeline.model_dump(mode="json"),
            "node_results": {nid: nr.model_dump(mode="json") for nid, nr in response.node_results.items()},
            "node_statuses": response.statuses,
            "summary": response.summary,
            "started_at": response.started_at.isoformat(),
            "completed_at": (response.completed_at or datetime.now(timezone.utc)).isoformat(),
            "run_to_node": request.run_to,
        }
        res = sb.table("pipeline_runs").insert(row).execute()
        if res.data:
            return res.data[0]["id"]
    except Exception as e:
        logger.warning("Failed to persist pipeline_run: %s", e)
    return None
