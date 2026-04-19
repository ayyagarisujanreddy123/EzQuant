"""
Canvas pipeline executor.

Walks a user-submitted DAG in topological order (Kahn's algorithm), dispatches
each node through BLOCK_REGISTRY, and assembles a RunResponse.

Design:
  - No class hierarchy. One public entry point: `execute_pipeline(pipeline, run_to)`.
  - DataFrames stay in memory during the run; discarded after. Only a truncated
    df_preview + shape + (where applicable) quality/metrics/diagnostics ship
    back to the frontend.
  - On a block error: that node is marked 'error', all strict descendants
    marked 'skipped'. Other independent branches keep running.
  - MVP: signal_diagnostics reads signal_df AND forward_return_df from the
    SAME upstream DataFrame (single-branch linear pipelines). Executor
    replicates the upstream df into both input keys.
"""
from __future__ import annotations

import logging
import traceback
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from backend.blocks import BLOCK_REGISTRY
from backend.schemas.pipeline import (
    DataQuality,
    DfPreview,
    NodeResult,
    Pipeline,
    RunResponse,
)

logger = logging.getLogger(__name__)

# df_preview caps. Rows sized for the Data-tab chart to span the full
# Universe window, not just a slice. ~3000 daily bars = ~12 years.
# Table rendering still slices to ~20 rows client-side.
PREVIEW_MAX_ROWS = 3000
PREVIEW_MAX_COLS = 10

SOURCE_BLOCKS = {"universe", "csv_upload"}
STRETCH_BLOCKS = {
    "drop_na",
    "resample",
    "z_score",
    "ems",
    "rolling_corr",
    "linear_reg",
    "equity_curve",
}


# ─── Public entry point ──────────────────────────────────────────────────────


def execute_pipeline(
    pipeline: Pipeline,
    run_to: Optional[str] = None,
) -> RunResponse:
    """Run a pipeline (or a subgraph ending at `run_to`)."""
    started_at = datetime.now(timezone.utc)

    nodes_by_id = {n.id: n for n in pipeline.nodes}
    if run_to and run_to not in nodes_by_id:
        return _error_response(f"run_to node {run_to!r} not in pipeline", started_at)

    # 1. Topological sort (Kahn) + cycle detection.
    try:
        order, incoming = _topo_sort(pipeline)
    except ValueError as e:
        return _error_response(str(e), started_at)

    # 2. Restrict to the subgraph that feeds run_to, if requested.
    if run_to:
        keep = _ancestors(run_to, pipeline.edges) | {run_to}
        order = [nid for nid in order if nid in keep]
        incoming = {nid: [e for e in edges if e.source in keep] for nid, edges in incoming.items() if nid in keep}

    # 3. Reject stretch blocks up-front — executor has no implementations.
    for nid in order:
        bt = nodes_by_id[nid].data.blockType
        if bt in STRETCH_BLOCKS:
            return _error_response(
                f"Block {bt!r} is marked stretch — no backend executor for it yet.",
                started_at,
            )
        if bt not in BLOCK_REGISTRY:
            return _error_response(
                f"Unknown block type {bt!r}. Available: {sorted(BLOCK_REGISTRY)}.",
                started_at,
            )

    # 4. Walk in order; propagate DataFrames; catch per-block errors.
    dfs: Dict[str, pd.DataFrame] = {}
    outputs: Dict[str, dict] = {}             # raw block returns
    statuses: Dict[str, str] = {nid: "idle" for nid in order}
    errors: Dict[str, str] = {}

    for nid in order:
        node = nodes_by_id[nid]
        bt = node.data.blockType

        # If any ancestor failed → skip.
        upstream_ids = [e.source for e in incoming.get(nid, [])]
        failed_ancestor = next((u for u in upstream_ids if statuses.get(u) in {"error", "skipped"}), None)
        if failed_ancestor:
            statuses[nid] = "skipped"
            errors[nid] = f"Skipped (upstream {failed_ancestor} failed)"
            continue

        statuses[nid] = "running"
        try:
            inputs = _build_inputs(node, incoming.get(nid, []), dfs)
            out = BLOCK_REGISTRY[bt](inputs, dict(node.data.params))
            if "df" not in out or out["df"] is None:
                raise ValueError("Block returned no 'df'.")
            dfs[nid] = out["df"]
            outputs[nid] = out
            statuses[nid] = "success"
        except Exception as e:
            logger.warning("Block %s (%s) failed: %s", nid, bt, e)
            statuses[nid] = "error"
            errors[nid] = f"{type(e).__name__}: {e}"
            logger.debug("%s", traceback.format_exc())

    # 5. Assemble per-node results.
    node_results: Dict[str, NodeResult] = {}
    for nid in order:
        node_results[nid] = _result_for_node(
            node=nodes_by_id[nid],
            status=statuses[nid],
            df=dfs.get(nid),
            raw_out=outputs.get(nid),
            error=errors.get(nid),
        )

    overall_status = (
        "error" if any(s == "error" for s in statuses.values())
        else "success"
    )
    summary = _build_summary(order, outputs)

    return RunResponse(
        run_id=None,                          # caller fills in when persisting
        status=overall_status,
        statuses=statuses,
        node_results=node_results,
        errors=errors,
        started_at=started_at,
        completed_at=datetime.now(timezone.utc),
        summary=summary,
    )


# ─── Topological sort + input wiring ─────────────────────────────────────────


def _topo_sort(p: Pipeline) -> Tuple[List[str], Dict[str, list]]:
    """Kahn's algorithm. Raises ValueError with the offending node if cyclic."""
    nodes = {n.id for n in p.nodes}
    outgoing: Dict[str, List[str]] = defaultdict(list)
    incoming: Dict[str, List] = defaultdict(list)
    indegree: Dict[str, int] = {nid: 0 for nid in nodes}

    for e in p.edges:
        if e.source not in nodes or e.target not in nodes:
            raise ValueError(f"Edge {e.id} references missing node(s).")
        outgoing[e.source].append(e.target)
        incoming[e.target].append(e)
        indegree[e.target] += 1

    queue = deque([nid for nid, d in indegree.items() if d == 0])
    order: List[str] = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for succ in outgoing[nid]:
            indegree[succ] -= 1
            if indegree[succ] == 0:
                queue.append(succ)

    if len(order) != len(nodes):
        stuck = sorted(nid for nid, d in indegree.items() if d > 0)
        raise ValueError(
            f"Pipeline contains a cycle; cannot topologically sort. "
            f"Node(s) remaining: {stuck}"
        )
    return order, incoming


def _ancestors(target: str, edges) -> set[str]:
    """All nodes that (transitively) feed into target."""
    parents: Dict[str, List[str]] = defaultdict(list)
    for e in edges:
        parents[e.target].append(e.source)

    visited: set[str] = set()
    stack = list(parents[target])
    while stack:
        nid = stack.pop()
        if nid in visited:
            continue
        visited.add(nid)
        stack.extend(parents[nid])
    return visited


def _build_inputs(node, in_edges, dfs: Dict[str, pd.DataFrame]) -> dict:
    """
    Build the `inputs` dict a block expects.

    Source blocks: {}.
    signal_diagnostics (MVP): expects {signal_df, forward_return_df}. We
      replicate the single upstream df into both keys.
    Everything else: {df}. If multiple upstreams exist (rare for MVP), the
      last one wins unless an edge specifies targetPort.
    """
    bt = node.data.blockType
    if bt in SOURCE_BLOCKS:
        return {}

    upstream_dfs = [dfs[e.source] for e in in_edges if e.source in dfs]
    if not upstream_dfs:
        raise ValueError(f"Block {node.id} has no upstream data.")

    if bt == "signal_diagnostics":
        df0 = upstream_dfs[0]
        return {"signal_df": df0, "forward_return_df": df0}

    # Edges carrying targetPort get routed explicitly.
    inputs: Dict[str, pd.DataFrame] = {}
    for e in in_edges:
        if e.source not in dfs:
            continue
        port = e.targetPort or "df"
        inputs[port] = dfs[e.source]
    if "df" not in inputs:
        inputs["df"] = upstream_dfs[-1]
    return inputs


# ─── Per-node result assembly ────────────────────────────────────────────────


def _result_for_node(node, status, df, raw_out, error) -> NodeResult:
    nr = NodeResult(node_id=node.id, status=status, error=error)
    if df is None or not isinstance(df, pd.DataFrame):
        return nr

    nr.shape = [int(df.shape[0]), int(df.shape[1])]
    nr.df_preview = _df_to_preview(df)

    if raw_out:
        metrics = raw_out.get("metrics")
        metadata = raw_out.get("metadata")
        if metrics is not None:
            nr.metrics = _jsonable(metrics)
        if metadata is not None:
            nr.metadata = _jsonable(metadata)

    if node.data.blockType in SOURCE_BLOCKS:
        nr.quality = _quality_from_df(df, raw_out)
    if node.data.blockType == "signal_diagnostics" and raw_out and raw_out.get("metrics"):
        nr.diagnostics = _jsonable(raw_out["metrics"])

    return nr


def _df_to_preview(df: pd.DataFrame) -> DfPreview:
    cols = list(df.columns[:PREVIEW_MAX_COLS])
    rows_df = df.head(PREVIEW_MAX_ROWS)[cols]

    # Build row-major JSONable values. Preserve the datetime index as a column.
    index_label = df.index.name or "index"
    values: List[List[Any]] = []
    for idx_val, row in rows_df.iterrows():
        rendered = [_jsonable_scalar(idx_val)]
        rendered.extend(_jsonable_scalar(v) for v in row.tolist())
        values.append(rendered)
    return DfPreview(
        columns=[index_label] + cols,
        rows=values,
        shape=[int(df.shape[0]), int(df.shape[1])],
    )


def _quality_from_df(df: pd.DataFrame, raw_out) -> DataQuality:
    rows = int(len(df))
    if rows == 0:
        return DataQuality(rows=0, dateRange="—")

    try:
        first = str(df.index[0].date())[2:]   # YY-MM-DD → MM-DD slice? use full 2-char year
    except Exception:
        first = str(df.index[0])[:10]
    try:
        last = str(df.index[-1].date())[2:]
    except Exception:
        last = str(df.index[-1])[:10]

    # Short "YY-MM" slice matches Inspector's existing format expectation.
    def _yy_mm(iso: str) -> str:
        # iso like "YY-MM-DD" (from .date()[2:]) or longer; trim to 5 chars
        return iso[:5] if len(iso) >= 5 else iso

    close_col = "Close" if "Close" in df.columns else df.columns[0]
    closes = pd.to_numeric(df[close_col], errors="coerce").dropna()
    sparkline: Optional[List[float]] = None
    if len(closes) > 1:
        mn, mx = float(closes.min()), float(closes.max())
        rng = mx - mn or 1.0
        target = 20
        step = max(1, len(closes) // target)
        sparkline = [float((closes.iloc[i] - mn) / rng) for i in range(0, len(closes), step)]

    missing = int(df.isna().any(axis=1).sum())
    nan_count = int(df.isna().sum().sum())

    return DataQuality(
        rows=rows,
        dateRange=f"{_yy_mm(first)} → {_yy_mm(last)}",
        missing=missing,
        nanCount=nan_count,
        lookaheadRisk=False,
        sparkline=sparkline,
    )


# ─── JSON helpers — pandas/numpy don't serialize cleanly by default ─────────


def _jsonable_scalar(v: Any) -> Any:
    if v is None:
        return None
    if isinstance(v, (np.floating, float)):
        f = float(v)
        return None if pd.isna(f) else f
    if isinstance(v, (np.integer, int, bool, np.bool_)):
        return int(v) if isinstance(v, (np.integer, int)) and not isinstance(v, bool) else bool(v)
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.isoformat()
    if isinstance(v, (np.ndarray,)):
        return [_jsonable_scalar(x) for x in v.tolist()]
    if isinstance(v, pd.Timedelta):
        return str(v)
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    return str(v) if not isinstance(v, (str, list, dict)) else v


def _jsonable(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {str(k): _jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_jsonable(v) for v in obj]
    return _jsonable_scalar(obj)


def _build_summary(order, outputs):
    """Pull top-line metrics (Sharpe, IC) from terminal blocks for the card on /projects."""
    summary: Dict[str, Any] = {}
    for nid in order:
        raw = outputs.get(nid)
        if not raw:
            continue
        m = raw.get("metrics")
        if not isinstance(m, dict):
            continue
        if "sharpe" in m and "sharpe" not in summary:
            summary["sharpe"] = _jsonable_scalar(m.get("sharpe"))
        if "ic" in m and "ic" not in summary:
            summary["ic"] = _jsonable_scalar(m.get("ic"))
    return summary


def _error_response(msg: str, started_at: datetime) -> RunResponse:
    return RunResponse(
        run_id=None,
        status="error",
        statuses={},
        node_results={},
        errors={"__pipeline__": msg},
        started_at=started_at,
        completed_at=datetime.now(timezone.utc),
        summary=None,
    )
