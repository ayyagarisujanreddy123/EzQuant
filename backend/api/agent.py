"""
Agent chat endpoint — POST /api/agent/chat (SSE stream).

Body:
  {
    "message": str,
    "page_context": { page, projectId?, projectName?, blockCount?, ... },
    "session_id": str,
    "project_id"?: str,
    "canvas_state"?: str,              # compact JSON from the frontend
    "mode"?: "ask" | "suggest" | "debug",
    "attachments"?: [...]              # metadata only; multimodal is not in scope
  }

Response: text/event-stream with one JSON event per frame. Event types:
  text, tool_use, citations, pipeline_template, done.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.agent.orchestrator import run_agent
from backend.auth import verify_jwt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChatRequest(BaseModel):
    message: str
    page_context: Dict[str, Any] = Field(default_factory=dict)
    session_id: str
    project_id: Optional[str] = None
    canvas_state: Optional[str] = None
    mode: Optional[str] = "ask"
    attachments: Optional[List[Dict[str, Any]]] = None


@router.post("/chat")
async def chat(
    req: ChatRequest,
    request: Request,
    user_id: str = Depends(verify_jwt),
) -> StreamingResponse:
    async def event_stream():
        try:
            async for event in run_agent(
                user_message=req.message,
                page_context=req.page_context or {},
                session_id=req.session_id,
                user_id=user_id,
                canvas_state=req.canvas_state,
                mode=req.mode or "ask",
                project_id=req.project_id,
                attachments=req.attachments,
            ):
                if await request.is_disconnected():
                    logger.info("Client disconnected mid-stream; aborting agent loop.")
                    return
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as e:
            logger.exception("Agent stream crashed")
            yield f"data: {json.dumps({'type': 'text', 'content': f'Agent error: {e}'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
