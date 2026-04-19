"""
Pydantic schemas for the pipeline executor API.

Shape mirrors the frontend CanvasNode / CanvasEdge / NodeData types. The
frontend POSTs a Pipeline; the backend returns a RunResponse with per-node
results. Keep this aligned with types/index.ts.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


BlockStatus = Literal["idle", "running", "success", "error", "skipped"]


class NodeData(BaseModel):
    """Minimum shape the executor needs from a frontend node's data."""
    id: str
    name: Optional[str] = None
    blockType: str             # registry name: "universe", "log_returns", ...
    params: Dict[str, Any] = Field(default_factory=dict)
    category: Optional[str] = None
    status: Optional[BlockStatus] = None
    source: Optional[str] = None


class Node(BaseModel):
    id: str
    type: str
    position: Optional[Dict[str, float]] = None
    data: NodeData


class Edge(BaseModel):
    id: str
    source: str
    target: str
    targetPort: Optional[str] = None     # e.g. "signal_df" / "forward_return_df"
    data: Optional[Dict[str, Any]] = None


class Pipeline(BaseModel):
    nodes: List[Node]
    edges: List[Edge]


class RunRequest(BaseModel):
    pipeline: Pipeline
    project_id: Optional[str] = None         # null for ad-hoc / Evaluate runs
    run_to: Optional[str] = None             # execute ancestors + this node only
    persist: bool = True                     # Evaluate sets False


class DfPreview(BaseModel):
    """Truncated DataFrame snapshot for the Data tab."""
    columns: List[str]
    rows: List[List[Any]]
    shape: List[int]                         # [total_rows, total_cols]


class DataQuality(BaseModel):
    rows: int
    dateRange: Optional[str] = None
    missing: int = 0
    nanCount: int = 0
    lookaheadRisk: bool = False
    sparkline: Optional[List[float]] = None


class NodeResult(BaseModel):
    node_id: str
    status: BlockStatus
    error: Optional[str] = None
    df_preview: Optional[DfPreview] = None
    shape: Optional[List[int]] = None        # [rows, cols]
    quality: Optional[DataQuality] = None    # source blocks
    metrics: Optional[Dict[str, Any]] = None # backtest / signal_diagnostics
    diagnostics: Optional[Dict[str, Any]] = None  # signal_diagnostics full set
    metadata: Optional[Dict[str, Any]] = None
    # Populated when Universe requested multiple tickers — each ticker has its
    # own sub-result (df_preview, metrics, diagnostics, etc.). Top-level fields
    # on NodeResult are the primary (first) ticker's view.
    per_ticker: Optional[Dict[str, "NodeResult"]] = None


NodeResult.model_rebuild()


class RunResponse(BaseModel):
    run_id: Optional[str] = None             # null when persist=False
    status: Literal["running", "success", "error"]
    statuses: Dict[str, BlockStatus]
    node_results: Dict[str, NodeResult]
    errors: Dict[str, str] = Field(default_factory=dict)
    started_at: datetime
    completed_at: Optional[datetime] = None
    summary: Optional[Dict[str, Any]] = None
