"""
Transform blocks — add one column to the DataFrame without mutating inputs.
"""
import numpy as np
import pandas as pd


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


def z_score(inputs: dict, params: dict) -> dict:
    """
    Rolling z-score: standardize `column` against its own trailing-window
    mean and sample standard deviation.

    Math (at each timestamp t, window size N):
        μ_t = mean(x[t-N+1 : t+1])
        σ_t = std(x[t-N+1 : t+1], ddof=1)     # sample std
        z_t = (x[t] - μ_t) / σ_t

    Properties:
      - Strictly TRAILING window (pandas rolling, min_periods=N). The
        value at row t only uses rows ≤ t, so there's zero lookahead.
      - First (N-1) rows are NaN. We refuse partial-window estimates
        rather than silently under-count and bias the early tail.
      - σ_t == 0 (constant window) or x[t] NaN → z_t NaN. No fake zeros,
        no inf values downstream.
      - Original columns preserved; input df is never mutated.

    Typical use: feed `log_return` in, get a normalised signal out that
    later blocks (signal, position_sizer) can threshold without having
    to care about scale differences across tickers.

    Output column name: ``z_{column}_{window}`` (e.g. ``z_log_return_20``).
    """
    df = inputs["df"].copy()
    column = str(params.get("column", "log_return"))
    window = int(params.get("window", 20))

    if column not in df.columns:
        raise ValueError(
            f"Column {column!r} not in DataFrame {list(df.columns)}"
        )
    if window < 2:
        raise ValueError(f"window must be >= 2, got {window}")

    series = pd.to_numeric(df[column], errors="coerce")
    rolling = series.rolling(window=window, min_periods=window)
    mean = rolling.mean()
    std = rolling.std(ddof=1)

    # σ==0 → replace with NaN so the division yields NaN rather than ±inf.
    std_safe = std.where(std > 0)
    z = (series - mean) / std_safe

    out_col = f"z_{column}_{window}"
    df[out_col] = z

    total = int(len(z))
    warmup_nans = int(min(window - 1, total))
    produced = int(z.notna().sum())

    return {
        "df": df,
        "metadata": {
            "output_column": out_col,
            "column": column,
            "window": window,
            "ddof": 1,
            "warmup_nans": warmup_nans,
            "produced_values": produced,
        },
    }
