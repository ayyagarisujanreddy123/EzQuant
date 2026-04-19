"""
Agent tools. Registered via @register; the orchestrator looks them up by name.

Every tool:
  - has a name matching the Gemini FunctionDeclaration
  - accepts plain-JSON kwargs
  - returns a JSON-serializable dict (ships back in a function_response part)
  - MUST NOT raise — catch failures and return {"error": "..."}
"""
from __future__ import annotations

import json
import logging
from typing import Any, Callable, Dict, List, Optional

import google.generativeai as genai
from google.generativeai import protos as gproto

from backend.agent.retrieval import retrieve_context
from backend.core.config import get_settings

logger = logging.getLogger(__name__)


# ─── Registry ────────────────────────────────────────────────────────────────

ToolFn = Callable[..., Dict[str, Any]]
_REGISTRY: Dict[str, ToolFn] = {}
_DECLS: Dict[str, gproto.FunctionDeclaration] = {}


def register(declaration: gproto.FunctionDeclaration):
    def decorator(fn: ToolFn) -> ToolFn:
        name = declaration.name
        _REGISTRY[name] = fn
        _DECLS[name] = declaration
        return fn
    return decorator


def get_tool(name: str) -> Optional[ToolFn]:
    return _REGISTRY.get(name)


def all_declarations() -> List[gproto.FunctionDeclaration]:
    return list(_DECLS.values())


# ─── search_knowledge ────────────────────────────────────────────────────────


@register(
    gproto.FunctionDeclaration(
        name="search_knowledge",
        description=(
            "Retrieve passages from the EzQuant quant-research knowledge base. "
            "Use this for conceptual questions (what is IC, how does EMA work, "
            "what's a reasonable Sharpe) and for grounding recommendations. "
            "Returns ranked chunks with source + similarity score."
        ),
        parameters=gproto.Schema(
            type=gproto.Type.OBJECT,
            properties={
                "query": gproto.Schema(
                    type=gproto.Type.STRING,
                    description="Focused search query. Prefer specific terms over whole sentences.",
                ),
                "source_type": gproto.Schema(
                    type=gproto.Type.STRING,
                    description="Optional: restrict to e.g. 'quant_reference' or 'pipeline_template'.",
                ),
                "recency_days": gproto.Schema(
                    type=gproto.Type.INTEGER,
                    description="Optional: only chunks ingested within the last N days.",
                ),
            },
            required=["query"],
        ),
    )
)
def search_knowledge(
    query: str,
    source_type: Optional[str] = None,
    recency_days: Optional[int] = None,
) -> Dict[str, Any]:
    try:
        chunks = retrieve_context(
            query=query,
            filters={
                "source_type": source_type,
                "recency_days": recency_days,
            },
            k=8,
        )
    except Exception as e:
        logger.warning("search_knowledge failed: %s", e)
        return {"error": f"retrieval failed: {e}", "chunks": []}

    # Strip noise: the agent only needs content + source + score.
    trimmed = [
        {
            "source": c.get("source"),
            "page": (c.get("metadata") or {}).get("page_number"),
            "similarity": round(c.get("similarity", 0.0), 4),
            "content": c.get("content"),
        }
        for c in chunks
    ]
    return {"chunks": trimmed, "count": len(trimmed)}


# ─── suggest_pipeline_template ───────────────────────────────────────────────

ALLOWED_BLOCKS = {
    "universe", "csv_upload", "log_returns", "forward_return",
    "ema", "momentum", "signal", "signal_diagnostics",
    "position_sizer", "backtest",
}


_TEMPLATE_PROMPT = """\
Produce a JSON pipeline template for the EzQuant canvas.

GOAL: {goal}
TICKER: {ticker}
CONSTRAINTS: {constraints}

RETRIEVED REFERENCE MATERIAL:
{context}

RULES:
- Use ONLY these block names: {allowed}.
- Every node needs: id (string), type (one of the allowed blocks), position ({{x, y}}),
  data {{ id, name, blockType (same as type), params (dict), category, source:"copilot" }}.
- Every edge: {{ id, source (node id), target (node id) }}.
- Categories per block:
  data=universe|csv_upload, clean=log_returns|forward_return,
  signal=ema|momentum|signal|signal_diagnostics, model=position_sizer, eval=backtest.
- Keep params minimal and sensible. Example Universe params:
  {{"name":"NVDA","symbol":"NVDA","start":"2020-01-01","end":"2024-01-01","interval":"1d"}}.
- Positions: layout left-to-right. x starts at 40 and increments by 180 for each step.
  y=60 for the main chain. Branch nodes (forward_return, signal_diagnostics) can be y=180.
- Provide `rationale` (2-3 sentences): why this structure answers the goal.

RESPOND WITH A SINGLE JSON OBJECT matching:
{{
  "name": "<short title>",
  "description": "<one sentence>",
  "rationale": "<why this pipeline>",
  "graph": {{ "nodes": [...], "edges": [...] }}
}}
"""


@register(
    gproto.FunctionDeclaration(
        name="suggest_pipeline_template",
        description=(
            "Build a validated EzQuant pipeline template matching the user's goal. "
            "Returns a graph of block nodes + edges the canvas can stage as "
            "ghosted (pending) nodes for the user to approve."
        ),
        parameters=gproto.Schema(
            type=gproto.Type.OBJECT,
            properties={
                "goal": gproto.Schema(
                    type=gproto.Type.STRING,
                    description="What the user wants to build. E.g. 'backtest a momentum strategy on NVDA'.",
                ),
                "ticker": gproto.Schema(
                    type=gproto.Type.STRING,
                    description="Optional primary ticker (e.g. 'NVDA').",
                ),
                "constraints": gproto.Schema(
                    type=gproto.Type.STRING,
                    description="Optional constraints (date range, interval, indicator preferences).",
                ),
            },
            required=["goal"],
        ),
    )
)
def suggest_pipeline_template(
    goal: str,
    ticker: Optional[str] = None,
    constraints: Optional[str] = None,
) -> Dict[str, Any]:
    # Pull in any pre-ingested pipeline_template reference chunks for priming.
    try:
        context_chunks = retrieve_context(
            query=goal + (f" {ticker}" if ticker else ""),
            filters={"source_type": "pipeline_template"},
            k=4,
        )
    except Exception:
        context_chunks = []

    context_text = (
        "\n---\n".join(c.get("content", "") for c in context_chunks)
        if context_chunks
        else "(no reference templates indexed yet)"
    )

    settings = get_settings()
    if not settings.google_api_key:
        return {"error": "GOOGLE_API_KEY not configured; cannot generate template."}

    genai.configure(api_key=settings.google_api_key)
    model = genai.GenerativeModel(settings.gemini_model)

    prompt = _TEMPLATE_PROMPT.format(
        goal=goal,
        ticker=ticker or "(unspecified)",
        constraints=constraints or "(none)",
        context=context_text,
        allowed=sorted(ALLOWED_BLOCKS),
    )

    # Up to 2 attempts: validator feedback loop on the second try.
    last_error: Optional[str] = None
    for attempt in range(2):
        try:
            response = model.generate_content(
                prompt if attempt == 0 else f"{prompt}\n\nPREVIOUS ATTEMPT ERRORS: {last_error}\nFIX AND RETURN JSON.",
                generation_config=genai.types.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.2,
                ),
            )
            raw = response.text or ""
            parsed = json.loads(raw)
            errors = _validate_template(parsed)
            if not errors:
                return {"ok": True, "template": parsed}
            last_error = "; ".join(errors)
        except json.JSONDecodeError as e:
            last_error = f"invalid JSON: {e}"
        except Exception as e:
            last_error = f"{type(e).__name__}: {e}"

    return {"error": f"Failed to produce a valid template: {last_error}"}


def _validate_template(t: Any) -> List[str]:
    errors: List[str] = []
    if not isinstance(t, dict):
        return ["root must be an object"]
    for key in ("name", "description", "graph"):
        if key not in t:
            errors.append(f"missing '{key}'")
    graph = t.get("graph") if isinstance(t.get("graph"), dict) else None
    if not graph:
        errors.append("graph must be an object with nodes + edges")
        return errors
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not nodes:
        errors.append("graph.nodes must be a non-empty array")
        return errors
    if not isinstance(edges, list):
        errors.append("graph.edges must be an array")
        edges = []

    seen_ids: set = set()
    type_by_id: dict = {}
    for i, n in enumerate(nodes):
        if not isinstance(n, dict):
            errors.append(f"nodes[{i}] is not an object")
            continue
        nid = n.get("id")
        ntype = n.get("type")
        data = n.get("data") or {}
        if not nid:
            errors.append(f"nodes[{i}].id missing")
        elif nid in seen_ids:
            errors.append(f"duplicate node id {nid!r}")
        else:
            seen_ids.add(nid)
            type_by_id[nid] = ntype
        if ntype not in ALLOWED_BLOCKS:
            errors.append(f"nodes[{i}].type={ntype!r} not in allowed blocks")
        if data.get("blockType") and data["blockType"] != ntype:
            errors.append(f"nodes[{i}] data.blockType {data['blockType']!r} != type {ntype!r}")

    for j, e in enumerate(edges):
        if not isinstance(e, dict):
            errors.append(f"edges[{j}] is not an object")
            continue
        s = e.get("source")
        tgt = e.get("target")
        if s not in seen_ids:
            errors.append(f"edges[{j}].source {s!r} not a known node")
        if tgt not in seen_ids:
            errors.append(f"edges[{j}].target {tgt!r} not a known node")

    # Hard rule: every signal_diagnostics node must have a signal block among
    # its transitive ancestors. Without it, diagnostics has no `df.signal`.
    diag_ids = [nid for nid, t_ in type_by_id.items() if t_ == "signal_diagnostics"]
    if diag_ids:
        parents: dict = {}
        for e in edges:
            if isinstance(e, dict):
                parents.setdefault(e.get("target"), []).append(e.get("source"))
        for d_id in diag_ids:
            if not _has_ancestor_of_type(d_id, parents, type_by_id, "signal"):
                errors.append(
                    f"signal_diagnostics node {d_id!r} has no upstream `signal` block "
                    "— insert one (source column = your feature, e.g. ema_20) before it"
                )
    return errors


def _has_ancestor_of_type(
    node_id: str, parents: dict, type_by_id: dict, target_type: str
) -> bool:
    seen: set = set()
    stack = list(parents.get(node_id, []))
    while stack:
        nid = stack.pop()
        if nid in seen:
            continue
        seen.add(nid)
        if type_by_id.get(nid) == target_type:
            return True
        stack.extend(parents.get(nid, []))
    return False
