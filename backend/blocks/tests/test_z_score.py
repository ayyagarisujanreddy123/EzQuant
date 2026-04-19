"""
Sanity tests for the rolling z-score block.

Covers:
  - Output column naming (z_{column}_{window}).
  - Exact math on a tiny deterministic series.
  - Warm-up: first (window-1) rows are NaN.
  - σ=0 (constant window) → NaN rather than ±inf.
  - Purely trailing window → row t only uses rows ≤ t (no lookahead).
  - Input DataFrame is not mutated.
"""
import math

import numpy as np
import pandas as pd
import pytest

from backend.blocks.transforms import z_score


def _frame(values):
    return pd.DataFrame({"log_return": values})


def test_output_column_name_and_schema():
    df = _frame([0.01, 0.02, -0.01, 0.03, -0.02, 0.01, 0.04, -0.03])
    out = z_score({"df": df}, {"column": "log_return", "window": 4})
    assert "z_log_return_4" in out["df"].columns
    meta = out["metadata"]
    assert meta["output_column"] == "z_log_return_4"
    assert meta["column"] == "log_return"
    assert meta["window"] == 4
    assert meta["warmup_nans"] == 3


def test_rolling_math_matches_manual_computation():
    # Deterministic 8-sample series; window = 4 → first valid row is index 3.
    values = [1.0, 2.0, 3.0, 4.0, 5.0, 4.0, 3.0, 2.0]
    df = _frame(values)
    out = z_score({"df": df}, {"column": "log_return", "window": 4})
    z = out["df"]["z_log_return_4"]

    # Manual check at t=3: window = [1, 2, 3, 4].
    window = np.array([1.0, 2.0, 3.0, 4.0])
    mu = window.mean()
    sigma = window.std(ddof=1)
    expected = (4.0 - mu) / sigma
    assert math.isclose(z.iloc[3], expected, rel_tol=1e-9)

    # Manual check at t=5: window = [3, 4, 5, 4].
    window = np.array([3.0, 4.0, 5.0, 4.0])
    mu = window.mean()
    sigma = window.std(ddof=1)
    expected = (4.0 - mu) / sigma
    assert math.isclose(z.iloc[5], expected, rel_tol=1e-9)


def test_warmup_rows_are_nan():
    df = _frame(range(10))
    out = z_score({"df": df}, {"column": "log_return", "window": 5})
    z = out["df"]["z_log_return_5"]
    # First (N-1)=4 rows must be NaN; row 4 must be the first finite value.
    assert z.iloc[:4].isna().all()
    assert np.isfinite(z.iloc[4])


def test_constant_window_gives_nan_not_inf():
    # First window is 4 zeros (σ=0); last window has variance > 0.
    values = [0.0, 0.0, 0.0, 0.0, 1.0, 2.0, 3.0, 4.0]
    df = _frame(values)
    out = z_score({"df": df}, {"column": "log_return", "window": 4})
    z = out["df"]["z_log_return_4"]
    # t=3 window all zeros → σ=0 → z NaN. No ±inf leakage.
    assert pd.isna(z.iloc[3])
    assert not np.isinf(z.dropna()).any()


def test_no_lookahead_row_t_only_uses_rows_up_to_t():
    # If we mutate a future row, z at t must not change.
    base = [1.0, 2.0, 3.0, 4.0, 5.0, 4.0, 3.0, 2.0]
    df_a = _frame(base)
    df_b = _frame(base.copy())
    df_b.loc[7, "log_return"] = 999.0  # Future row blown up.

    z_a = z_score({"df": df_a}, {"column": "log_return", "window": 4})["df"][
        "z_log_return_4"
    ]
    z_b = z_score({"df": df_b}, {"column": "log_return", "window": 4})["df"][
        "z_log_return_4"
    ]

    # Rows 0..6 must match exactly — only row 7 may differ.
    pd.testing.assert_series_equal(z_a.iloc[:7], z_b.iloc[:7])


def test_input_dataframe_is_not_mutated():
    df = _frame([0.01, 0.02, -0.01, 0.03, -0.02, 0.01, 0.04, -0.03])
    snapshot = df.copy(deep=True)
    z_score({"df": df}, {"column": "log_return", "window": 4})
    pd.testing.assert_frame_equal(df, snapshot)


def test_missing_column_raises():
    df = _frame([1.0, 2.0, 3.0, 4.0])
    with pytest.raises(ValueError, match="Column 'log_return' not in DataFrame"):
        z_score({"df": df.rename(columns={"log_return": "x"})}, {"column": "log_return"})


def test_window_too_small_raises():
    df = _frame([1.0, 2.0, 3.0, 4.0])
    with pytest.raises(ValueError, match="window must be >= 2"):
        z_score({"df": df}, {"column": "log_return", "window": 1})


def test_registered_in_block_registry_and_not_stretch():
    """
    Guard against the regression that caused the canvas to "hang": the
    pipeline runner's STRETCH_BLOCKS set used to include z_score, so the
    runner aborted the pipeline before this function was ever called.
    """
    from backend.blocks import BLOCK_REGISTRY
    from backend.services.pipeline_runner import STRETCH_BLOCKS

    assert "z_score" in BLOCK_REGISTRY, "z_score must be registered for the runner to find it"
    assert BLOCK_REGISTRY["z_score"] is z_score
    assert "z_score" not in STRETCH_BLOCKS, (
        "z_score was rejected by the runner as a stretch block — remove it from "
        "STRETCH_BLOCKS so the runner will execute it"
    )


def test_pipeline_runner_executes_z_score_without_yfinance():
    """
    Confirm the runner dispatches z_score end-to-end on a hand-built df so we
    don't need a network call to catch a future STRETCH_BLOCKS regression.
    """
    import pandas as pd

    from backend.schemas.pipeline import Edge, Node, NodeData, Pipeline
    from backend.services import pipeline_runner as pr

    # Patch csv_upload to return a deterministic frame so execute_pipeline
    # runs entirely in-process (no yfinance).
    original = pr.BLOCK_REGISTRY["csv_upload"]

    def fake_csv(_inputs, _params):
        df = pd.DataFrame({"Close": [100.0 + i for i in range(30)]})
        return {"df": df}

    pr.BLOCK_REGISTRY["csv_upload"] = fake_csv
    try:
        def mk(id_, bt, cat, params):
            return Node(
                id=id_, type=bt, position={"x": 0, "y": 0},
                data=NodeData(
                    id=id_, name=id_, category=cat, status="idle",
                    source="user", blockType=bt, params=params,
                ),
            )

        pipeline = Pipeline(
            nodes=[
                mk("a", "csv_upload", "data", {"file_path": "", "date_column": "Date"}),
                mk("b", "log_returns", "clean", {"column": "Close"}),
                mk("c", "z_score", "clean", {"column": "log_return", "window": 5}),
            ],
            edges=[
                Edge(id="e1", source="a", target="b"),
                Edge(id="e2", source="b", target="c"),
            ],
        )

        res = pr.execute_pipeline(pipeline)
        assert res.statuses == {"a": "success", "b": "success", "c": "success"}, res.errors
        assert res.node_results["c"].metadata["output_column"] == "z_log_return_5"
        assert "z_log_return_5" in res.node_results["c"].df_preview.columns
    finally:
        pr.BLOCK_REGISTRY["csv_upload"] = original
