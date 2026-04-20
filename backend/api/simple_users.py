"""
Simple-identity API — no email, no password, no Supabase Auth.

The frontend hashes (full_name, dob) into a stable UUID and sends it as
`user_id` on every call. The backend uses the service-role Supabase client
to upsert a row in `simple_users` and to store / fetch projects filtered by
that user_id. RLS is opened up to the service role only; the anon key never
touches the DB from the browser in this mode.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/simple", tags=["simple-identity"])


# ── Schemas ───────────────────────────────────────────────────────────────


class UpsertUserIn(BaseModel):
    user_id: str
    full_name: str
    dob: str  # ISO yyyy-mm-dd


class UpsertUserOut(BaseModel):
    user_id: str
    full_name: str
    dob: str


class ProjectGraph(BaseModel):
    nodes: List[Dict[str, Any]] = Field(default_factory=list)
    edges: List[Dict[str, Any]] = Field(default_factory=list)


class CreateProjectIn(BaseModel):
    user_id: str
    name: str
    graph: Optional[ProjectGraph] = None


class UpdateProjectIn(BaseModel):
    user_id: str
    name: Optional[str] = None
    graph: Optional[ProjectGraph] = None


class ProjectRow(BaseModel):
    id: str
    name: str
    sharpe: Optional[float] = None
    block_count: Optional[int] = None
    status: Optional[str] = None
    updated_at: str
    graph: Optional[Dict[str, Any]] = None


# ── Helpers ───────────────────────────────────────────────────────────────


def _sb_or_500():
    sb = get_service_client()
    if sb is None:
        raise HTTPException(
            status_code=500,
            detail="Supabase service-role client not configured. "
                   "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.",
        )
    return sb


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Routes ────────────────────────────────────────────────────────────────


@router.post("/user", response_model=UpsertUserOut)
async def upsert_user(body: UpsertUserIn) -> UpsertUserOut:
    """
    Idempotent upsert on simple_users. Same (user_id) → updates last_seen.
    """
    sb = _sb_or_500()
    try:
        sb.table("simple_users").upsert(
            {
                "id": body.user_id,
                "full_name": body.full_name,
                "dob": body.dob,
                "last_seen": _now_iso(),
            },
            on_conflict="id",
        ).execute()
    except Exception as e:
        logger.exception("simple_users upsert failed")
        raise HTTPException(status_code=502, detail=f"Supabase upsert failed: {e}")
    return UpsertUserOut(user_id=body.user_id, full_name=body.full_name, dob=body.dob)


@router.get("/projects")
async def list_projects(user_id: str) -> Dict[str, List[ProjectRow]]:
    sb = _sb_or_500()
    try:
        res = (
            sb.table("projects")
            .select("id, name, sharpe, block_count, status, updated_at, graph")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
    except Exception as e:
        logger.exception("project list failed")
        raise HTTPException(status_code=502, detail=f"Supabase list failed: {e}")
    return {"projects": [ProjectRow(**r) for r in (res.data or [])]}


@router.post("/projects", response_model=ProjectRow)
async def create_project(body: CreateProjectIn) -> ProjectRow:
    sb = _sb_or_500()
    graph = (body.graph.model_dump() if body.graph else {"nodes": [], "edges": []})
    try:
        res = (
            sb.table("projects")
            .insert(
                {
                    "user_id": body.user_id,
                    "name": body.name,
                    "graph": graph,
                    "block_count": len(graph.get("nodes") or []),
                    "status": "draft",
                }
            )
            .select("id, name, sharpe, block_count, status, updated_at, graph")
            .single()
            .execute()
        )
    except Exception as e:
        logger.exception("project create failed")
        raise HTTPException(status_code=502, detail=f"Supabase insert failed: {e}")
    if not res.data:
        raise HTTPException(status_code=502, detail="Insert returned no row.")
    return ProjectRow(**res.data)


@router.get("/projects/{project_id}", response_model=ProjectRow)
async def get_project(project_id: str, user_id: str) -> ProjectRow:
    sb = _sb_or_500()
    try:
        res = (
            sb.table("projects")
            .select("id, name, sharpe, block_count, status, updated_at, graph")
            .eq("id", project_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except Exception as e:
        logger.exception("project fetch failed")
        raise HTTPException(status_code=404, detail=f"Project not found: {e}")
    if not res.data:
        raise HTTPException(status_code=404, detail="Project not found.")
    return ProjectRow(**res.data)


@router.patch("/projects/{project_id}", response_model=ProjectRow)
async def update_project(project_id: str, body: UpdateProjectIn) -> ProjectRow:
    sb = _sb_or_500()
    patch: Dict[str, Any] = {}
    if body.name is not None:
        patch["name"] = body.name
    if body.graph is not None:
        g = body.graph.model_dump()
        patch["graph"] = g
        patch["block_count"] = len(g.get("nodes") or [])
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    try:
        res = (
            sb.table("projects")
            .update(patch)
            .eq("id", project_id)
            .eq("user_id", body.user_id)
            .select("id, name, sharpe, block_count, status, updated_at, graph")
            .single()
            .execute()
        )
    except Exception as e:
        logger.exception("project update failed")
        raise HTTPException(status_code=502, detail=f"Supabase update failed: {e}")
    if not res.data:
        raise HTTPException(status_code=404, detail="Project not found.")
    return ProjectRow(**res.data)


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user_id: str) -> Dict[str, Any]:
    sb = _sb_or_500()
    try:
        sb.table("projects").delete().eq("id", project_id).eq("user_id", user_id).execute()
    except Exception as e:
        logger.exception("project delete failed")
        raise HTTPException(status_code=502, detail=f"Supabase delete failed: {e}")
    return {"ok": True, "id": project_id}
