"""
Feature blocks — derive signal candidates from a price or return column.
"""


def ema(inputs: dict, params: dict) -> dict:
    """
    Add an 'ema_{span}' column — exponential moving average.

    A common signal-construction primitive; on its own it lags price but is
    the building block for EMA crossovers and momentum variants.
    """
    df = inputs["df"].copy()
    column = params.get("column", "Close")
    span = int(params.get("span", 20))
    if column not in df.columns:
        raise ValueError(f"Column {column!r} not in DataFrame {list(df.columns)}")
    if span < 1:
        raise ValueError(f"span must be >= 1, got {span}")
    df[f"ema_{span}"] = df[column].ewm(span=span, adjust=False).mean()
    return {"df": df}


def momentum(inputs: dict, params: dict) -> dict:
    """
    Add a 'momentum_{lookback}' column.

    mode='price'  : price_t - price_{t-lookback}            (classic price momentum)
    mode='return' : rolling sum of returns over `lookback`  (cumulative return)
    """
    df = inputs["df"].copy()
    column = params.get("column", "Close")
    lookback = int(params.get("lookback", 20))
    mode = params.get("mode", "price")
    if column not in df.columns:
        raise ValueError(f"Column {column!r} not in DataFrame {list(df.columns)}")
    if lookback < 1:
        raise ValueError(f"lookback must be >= 1, got {lookback}")
    if mode == "price":
        df[f"momentum_{lookback}"] = df[column] - df[column].shift(lookback)
    elif mode == "return":
        df[f"momentum_{lookback}"] = df[column].rolling(lookback).sum()
    else:
        raise ValueError(f"mode must be 'price' or 'return', got {mode!r}")
    return {"df": df}
