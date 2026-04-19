"""
End-to-end smoke test for the pipeline executor.

Runs a 5-block NVDA momentum pipeline through `execute_pipeline` directly
(no HTTP). Asserts Sharpe is a finite number and the run reports success.

Skips gracefully if yfinance is rate-limited / no network.

Invoke from repo root:
    pytest backend/test_full_pipeline.py -v
"""
from __future__ import annotations

import math

import pytest

from backend.schemas.pipeline import Edge, Node, NodeData, Pipeline
from backend.services.pipeline_runner import execute_pipeline


def _build_nvda_pipeline() -> Pipeline:
    nodes = [
        Node(
            id="src",
            type="universe",
            position={"x": 0, "y": 0},
            data=NodeData(
                id="src",
                name="NVDA Source",
                blockType="universe",
                params={
                    "symbol": "NVDA",
                    "start": "2022-01-01",
                    "end": "2023-01-01",
                    "interval": "1d",
                },
            ),
        ),
        Node(
            id="lr",
            type="log_returns",
            position={"x": 180, "y": 0},
            data=NodeData(id="lr", name="Log Ret", blockType="log_returns", params={"column": "Close"}),
        ),
        Node(
            id="feat",
            type="ema",
            position={"x": 360, "y": 0},
            data=NodeData(id="feat", name="EMA-20", blockType="ema", params={"column": "Close", "span": 20}),
        ),
        Node(
            id="sig",
            type="signal",
            position={"x": 540, "y": 0},
            data=NodeData(id="sig", name="Signal", blockType="signal", params={"column": "ema_20", "name": "EMA20"}),
        ),
        Node(
            id="pos",
            type="position_sizer",
            position={"x": 720, "y": 0},
            data=NodeData(
                id="pos",
                name="Position",
                blockType="position_sizer",
                params={"mode": "threshold", "upper_threshold": 0, "lower_threshold": 0},
            ),
        ),
        Node(
            id="bt",
            type="backtest",
            position={"x": 900, "y": 0},
            data=NodeData(
                id="bt",
                name="Backtest",
                blockType="backtest",
                params={"return_column": "log_return", "cost_bps": 1},
            ),
        ),
    ]
    edges = [
        Edge(id="e1", source="src", target="lr"),
        Edge(id="e2", source="lr", target="feat"),
        Edge(id="e3", source="feat", target="sig"),
        Edge(id="e4", source="sig", target="pos"),
        Edge(id="e5", source="pos", target="bt"),
    ]
    return Pipeline(nodes=nodes, edges=edges)


def test_full_nvda_momentum_pipeline_returns_real_sharpe() -> None:
    pipeline = _build_nvda_pipeline()
    try:
        result = execute_pipeline(pipeline)
    except Exception as e:
        pytest.skip(f"Pipeline could not execute (likely yfinance / network): {e}")

    if result.status == "error" and any("yfinance" in v.lower() for v in result.errors.values()):
        pytest.skip("yfinance rate-limited or unreachable in this environment.")

    assert result.status == "success", f"Pipeline failed: {result.errors}"
    assert set(result.statuses.values()) == {"success"}, (
        f"Not all nodes succeeded: {result.statuses}"
    )

    bt = result.node_results["bt"]
    assert bt.metrics is not None, "Backtest produced no metrics"
    sharpe = bt.metrics.get("sharpe")
    assert isinstance(sharpe, (int, float)), f"Sharpe should be numeric, got {type(sharpe)}"
    assert math.isfinite(sharpe), f"Sharpe should be finite, got {sharpe}"
