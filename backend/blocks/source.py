"""
Source blocks — entry points to a pipeline. They produce a DataFrame with
a DateTimeIndex and do not read from `inputs`.
"""
import pandas as pd
import yfinance as yf


def universe(inputs: dict, params: dict) -> dict:
    """
    Download OHLCV bars for a single ticker via yfinance.

    Source block: ignores `inputs`. This is typically the first node in a
    pipeline — it defines the "universe" of prices we're researching on.
    """
    symbol = params["symbol"]
    start = params["start"]
    end = params["end"]
    interval = params.get("interval", "1d")

    df = yf.download(
        symbol,
        start=start,
        end=end,
        interval=interval,
        auto_adjust=True,
        progress=False,
    )
    if df.empty:
        raise ValueError(f"yfinance returned no data for {symbol}")

    # yfinance returns a MultiIndex on columns even for a single ticker in
    # newer versions — flatten to simple column names.
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df = df.dropna(how="all")
    df.index = pd.DatetimeIndex(df.index)
    df.index.name = "Date"

    metadata = {
        "symbol": symbol,
        "start": start,
        "end": end,
        "row_count": int(len(df)),
        "nan_count_per_column": {c: int(df[c].isna().sum()) for c in df.columns},
        "date_range": (str(df.index[0].date()), str(df.index[-1].date())),
    }
    return {"df": df, "metadata": metadata}


def csv_upload(inputs: dict, params: dict) -> dict:
    """
    Load a CSV with a date column. Demo-fallback when yfinance is rate-limited.
    """
    file_path = params["file_path"]
    date_column = params["date_column"]
    price_columns = params.get("price_columns")

    df = pd.read_csv(file_path)
    if date_column not in df.columns:
        raise ValueError(
            f"date_column {date_column!r} not in CSV columns {list(df.columns)}"
        )
    df[date_column] = pd.to_datetime(df[date_column])
    df = df.set_index(date_column).sort_index()
    df.index.name = "Date"

    if price_columns is not None:
        missing = [c for c in price_columns if c not in df.columns]
        if missing:
            raise ValueError(f"price_columns not found in CSV: {missing}")
        df = df[price_columns]

    metadata = {
        "row_count": int(len(df)),
        "nan_count_per_column": {c: int(df[c].isna().sum()) for c in df.columns},
        "date_range": (str(df.index[0].date()), str(df.index[-1].date())),
    }
    return {"df": df, "metadata": metadata}
