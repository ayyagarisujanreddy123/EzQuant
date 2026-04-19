"""
Transform blocks — add one column to the DataFrame without mutating inputs.
"""
import numpy as np


def log_returns(inputs: dict, params: dict) -> dict:
    """
    Add a 'log_return' column: log(price_t / price_{t-1}).

    Log returns are additive over time, which is why we prefer them for
    signal construction and backtesting over simple returns.
    """
    df = inputs["df"].copy()
    column = params.get("column", "Close")
    if column not in df.columns:
        raise ValueError(f"Column {column!r} not in DataFrame {list(df.columns)}")
    df["log_return"] = np.log(df[column] / df[column].shift(1))
    return {"df": df}


def forward_return(inputs: dict, params: dict) -> dict:
    """
    Add a 'forward_return_{horizon}' column: log(price_{t+h} / price_t).

    This is the prediction target. Making it an explicit block is what makes
    the research question legible on the canvas — we're predicting THIS.
    """
    df = inputs["df"].copy()
    column = params.get("column", "Close")
    horizon = int(params.get("horizon", 1))
    if column not in df.columns:
        raise ValueError(f"Column {column!r} not in DataFrame {list(df.columns)}")
    if horizon <= 0:
        raise ValueError(f"horizon must be >= 1, got {horizon}")
    df[f"forward_return_{horizon}"] = np.log(df[column].shift(-horizon) / df[column])
    return {"df": df}
