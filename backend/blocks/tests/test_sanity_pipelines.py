"""
IC framework sanity tests.

These validate that signal_diagnostics is mathematically correct before any
real research is done. They're documentation as much as they are validation:
what each test fails mean is explained in its docstring.
"""
import numpy as np

from backend.blocks.signal import signal, signal_diagnostics
from backend.blocks.transforms import forward_return, log_returns


def test_ic_equals_one_when_signal_is_forward_return(spy_df):
    """
    Trivial case: signal literally IS the target (forward_return_1).
    Expected IC ~= 1.0.

    Failure meaning: signal_diagnostics is broken at the most basic level —
    the correlation math or the index alignment is wrong.
    """
    out1 = log_returns({"df": spy_df}, {"column": "Close"})
    out2 = forward_return({"df": out1["df"]}, {"column": "Close", "horizon": 1})
    out3 = signal({"df": out2["df"]}, {"column": "forward_return_1"})
    diag = signal_diagnostics(
        {"signal_df": out3["df"], "forward_return_df": out3["df"]},
        {"forward_return_column": "forward_return_1"},
    )
    assert abs(diag["metrics"]["ic"] - 1.0) < 0.01


def test_ic_near_zero_for_random_noise_signal(spy_df):
    """
    Random noise has no predictive content: |IC| < 0.05 and |t| < 2.0.

    Failure meaning: if noise produces a large IC, there is a lookahead or
    alignment bug leaking future information into the signal.
    """
    out1 = log_returns({"df": spy_df}, {"column": "Close"})
    out2 = forward_return({"df": out1["df"]}, {"column": "Close", "horizon": 1})
    df = out2["df"].copy()
    df["noise"] = np.random.default_rng(seed=42).standard_normal(len(df))
    out3 = signal({"df": df}, {"column": "noise"})
    diag = signal_diagnostics(
        {"signal_df": out3["df"], "forward_return_df": out3["df"]},
        {"forward_return_column": "forward_return_1"},
    )
    assert abs(diag["metrics"]["ic"]) < 0.05
    assert abs(diag["metrics"]["ic_tstat"]) < 2.0


def test_ic_detects_lookahead_when_signal_uses_future(spy_df):
    """
    Deliberate lookahead: signal = log_return.shift(-1) (tomorrow's return,
    impossibly known today). Expected IC > 0.95.

    This test documents the signature of a lookahead bug — implausibly high
    IC — and is the reference point for the future Lookahead Guard block.
    """
    out1 = log_returns({"df": spy_df}, {"column": "Close"})
    out2 = forward_return({"df": out1["df"]}, {"column": "Close", "horizon": 1})
    df = out2["df"].copy()
    df["cheat"] = df["log_return"].shift(-1)
    out3 = signal({"df": df}, {"column": "cheat"})
    diag = signal_diagnostics(
        {"signal_df": out3["df"], "forward_return_df": out3["df"]},
        {"forward_return_column": "forward_return_1"},
    )
    assert diag["metrics"]["ic"] > 0.95
