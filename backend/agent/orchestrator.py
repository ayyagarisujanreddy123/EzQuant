"""
Gemini function-calling orchestrator.

Yields SSE events as an async generator. Consumed by api/agent.py and streamed
to the browser one line per event.

Design:
- MANUAL function calling (enable_automatic_function_calling=False)
- Safety: BLOCK_ONLY_HIGH for all categories
- Hard cap of 5 tool calls per turn (MAX_TOOL_TURNS)
- Each turn is persisted to copilot_messages (one row: user, one row: assistant)
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional

import google.generativeai as genai
from google.generativeai import protos as gproto
from google.generativeai.types import HarmBlockThreshold, HarmCategory

from backend.agent import tools as toolreg
from backend.agent.prompts import build_system_prompt
from backend.core.config import get_settings
from backend.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

MAX_TOOL_TURNS = 5
HISTORY_LIMIT = 20          # prior turns loaded into Gemini chat per new message
HISTORY_MAX_CHARS = 2000    # truncate any single prior turn to this many chars

SAFETY_SETTINGS = {
    HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_ONLY_HIGH,
}


async def run_agent(
    user_message: str,
    page_context: Dict[str, Any],
    session_id: str,
    user_id: str,
    canvas_state: Optional[str] = None,
    mode: str = "ask",
    project_id: Optional[str] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    settings = get_settings()
    if not settings.google_api_key:
        yield {"type": "text", "content": "Server missing GOOGLE_API_KEY — cannot call Gemini."}
        yield {"type": "done"}
        return

    genai.configure(api_key=settings.google_api_key)

    # Persist the user's turn upfront so we capture it even on crash.
    _persist_message(
        user_id=user_id,
        project_id=project_id,
        session_id=session_id,
        role="user",
        content=user_message,
        attachments=attachments,
    )

    system_prompt = build_system_prompt(
        page_context=page_context,
        mode=mode,
        canvas_state=canvas_state,
    )

    tools_arg = [gproto.Tool(function_declarations=toolreg.all_declarations())]
    model = genai.GenerativeModel(
        settings.gemini_model,
        system_instruction=system_prompt,
        tools=tools_arg,
        safety_settings=SAFETY_SETTINGS,
    )

    # Load prior turns for this (user, session) so conversation continuity works
    # across page reloads. Persisted rows in copilot_messages.
    history = _load_session_history(session_id=session_id, user_id=user_id)
    chat = model.start_chat(history=history, enable_automatic_function_calling=False)

    # Accumulators for the persisted assistant turn.
    assistant_text_parts: List[str] = []
    tool_calls_log: List[Dict[str, Any]] = []
    citations: List[Dict[str, Any]] = []

    message_to_send: Any = user_message

    for turn_idx in range(MAX_TOOL_TURNS + 1):
        try:
            response = chat.send_message(message_to_send)
        except Exception as e:
            logger.exception("Gemini call failed")
            yield {"type": "text", "content": f"Gemini error: {type(e).__name__}: {e}"}
            break

        function_calls: List[gproto.FunctionCall] = []
        text_buf: List[str] = []

        # Walk the response parts — mix of text + function calls.
        candidate = response.candidates[0] if response.candidates else None
        if candidate and candidate.content and candidate.content.parts:
            for part in candidate.content.parts:
                if getattr(part, "text", None):
                    text_buf.append(part.text)
                fc = getattr(part, "function_call", None)
                if fc and fc.name:
                    function_calls.append(fc)

        if text_buf:
            joined = "".join(text_buf)
            assistant_text_parts.append(joined)
            yield {"type": "text", "content": joined}

        if not function_calls:
            # No more tools to call → we're done.
            break

        if turn_idx >= MAX_TOOL_TURNS:
            # Safety cap — don't let a runaway loop chew through quota.
            yield {
                "type": "text",
                "content": "(stopped: exceeded tool-call cap for this turn)",
            }
            break

        # Execute every function call in this turn, feed results back.
        function_responses: List[gproto.Part] = []
        for fc in function_calls:
            name = fc.name
            args = _args_to_dict(fc.args)
            yield {
                "type": "tool_use",
                "tool": name,
                "summary": _brief_args(args),
                "status": "running",
            }

            tool_fn = toolreg.get_tool(name)
            if tool_fn is None:
                result: Dict[str, Any] = {"error": f"unknown tool {name}"}
            else:
                try:
                    result = tool_fn(**args)
                except Exception as e:
                    logger.exception("Tool %s raised", name)
                    result = {"error": f"{type(e).__name__}: {e}"}

            tool_calls_log.append({"tool": name, "args": args, "result": _brief_result(result)})
            yield {
                "type": "tool_use",
                "tool": name,
                "summary": _brief_result(result),
                "status": "done",
            }

            # Surface citations from search_knowledge.
            if name == "search_knowledge" and isinstance(result, dict):
                for i, chunk in enumerate(result.get("chunks", []) or [], start=1):
                    citations.append(
                        {
                            "num": len(citations) + 1,
                            "source": chunk.get("source"),
                            "page": chunk.get("page"),
                            "similarity": chunk.get("similarity"),
                        }
                    )

            # Surface pipeline templates as their own event so the canvas can stage them.
            if name == "suggest_pipeline_template" and isinstance(result, dict):
                if result.get("ok") and result.get("template"):
                    yield {"type": "pipeline_template", "template": result["template"]}

            function_responses.append(
                gproto.Part(
                    function_response=gproto.FunctionResponse(
                        name=name,
                        response={"content": json.dumps(result, default=str)},
                    )
                )
            )

        # Next turn: feed the function responses back to Gemini.
        message_to_send = function_responses

    if citations:
        # De-dupe by source+page; renumber.
        unique: List[Dict[str, Any]] = []
        seen: set = set()
        for c in citations:
            key = (c.get("source"), c.get("page"))
            if key in seen:
                continue
            seen.add(key)
            c["num"] = len(unique) + 1
            unique.append(c)
        yield {"type": "citations", "sources": unique}
        citations = unique

    _persist_message(
        user_id=user_id,
        project_id=project_id,
        session_id=session_id,
        role="assistant",
        content="".join(assistant_text_parts),
        tool_calls=tool_calls_log,
        citations=citations,
    )

    yield {"type": "done"}


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _args_to_dict(struct: Any) -> Dict[str, Any]:
    """Convert a proto MapComposite (Struct) into a plain dict."""
    try:
        return {k: _py(v) for k, v in struct.items()}
    except Exception:
        return {}


def _py(v: Any) -> Any:
    if hasattr(v, "items"):
        return {k: _py(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_py(x) for x in v]
    return v


def _brief_args(args: Dict[str, Any]) -> str:
    if not args:
        return ""
    q = args.get("query") or args.get("goal")
    if q:
        return str(q)[:80]
    return ", ".join(f"{k}={v}" for k, v in list(args.items())[:2])[:80]


def _brief_result(result: Dict[str, Any]) -> str:
    if not isinstance(result, dict):
        return "ok"
    if result.get("error"):
        return f"error: {result['error'][:60]}"
    if "count" in result:
        return f"{result['count']} chunks"
    if result.get("template"):
        tpl = result["template"]
        nodes = ((tpl.get("graph") or {}).get("nodes") or [])
        return f"{len(nodes)} blocks · {tpl.get('name', 'template')}"
    return "ok"


def _load_session_history(
    *, session_id: str, user_id: str, limit: int = HISTORY_LIMIT
) -> List[Any]:
    """
    Pull prior (user, assistant) turns for this session from copilot_messages
    and shape them into Gemini's chat history format.

    Gemini wants a list of {role: 'user'|'model', parts: [text]}. We drop tool
    calls from the replay (the model regenerates those as needed) and cap each
    message so a long history doesn't blow the context window.
    """
    sb = get_service_client()
    if sb is None or not session_id:
        return []
    try:
        res = (
            sb.table("copilot_messages")
            .select("role, content, created_at")
            .eq("session_id", session_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as e:
        logger.warning("load_session_history failed: %s", e)
        return []

    rows = list(reversed(res.data or []))
    history: List[Any] = []
    for r in rows:
        role_raw = (r.get("role") or "").lower()
        content = (r.get("content") or "").strip()
        if not content:
            continue
        # assistant/agent → 'model'; user → 'user'; skip system.
        if role_raw in {"assistant", "agent", "model"}:
            role = "model"
        elif role_raw == "user":
            role = "user"
        else:
            continue
        if len(content) > HISTORY_MAX_CHARS:
            content = content[: HISTORY_MAX_CHARS] + "…"
        history.append(
            gproto.Content(role=role, parts=[gproto.Part(text=content)])
        )
    return history


def _persist_message(
    *,
    user_id: str,
    project_id: Optional[str],
    session_id: str,
    role: str,
    content: str,
    tool_calls: Optional[List[Dict[str, Any]]] = None,
    citations: Optional[List[Dict[str, Any]]] = None,
    attachments: Optional[List[Dict[str, Any]]] = None,
) -> None:
    sb = get_service_client()
    if sb is None:
        return
    try:
        sb.table("copilot_messages").insert(
            {
                "user_id": user_id,
                "project_id": project_id,
                "session_id": session_id,
                "role": role,
                "content": content or "",
                "tool_calls": tool_calls or None,
                "citations": citations or None,
                "attachments": attachments or None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ).execute()
    except Exception as e:
        logger.warning("Failed to persist copilot_message (%s): %s", role, e)
