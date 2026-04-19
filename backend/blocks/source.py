"""
Source blocks — entry points to a pipeline. They produce a DataFrame with
a DateTimeIndex and do not read from `inputs`.
"""
import pandas as pd
import yfinance as yf


def _parse_symbols(raw: str) -> list[str]:
    """Split a 'NVDA, AAPL , SPY' string into a clean list of tickers."""
    if not raw:
        return []
    return [s.strip().upper() for s in str(raw).replace(";", ",").split(",") if s.strip()]


def universe(inputs: dict, params: dict) -> dict:
    """
    Download OHLCV bars for one OR MANY tickers via yfinance.

    Source block: ignores `inputs`. `params["symbol"]` may be a single ticker
    ("NVDA") or a comma-separated list ("NVDA, AAPL, SPY"). For the multi-
    ticker case the block returns the first ticker as the primary `df` and
    attaches `metadata.per_ticker` — a dict of {ticker: DataFrame} — which the
    pipeline runner uses to fork downstream execution per ticker.
    """
    raw = params["symbol"]
    start = params["start"]
    end = params["end"]
    interval = params.get("interval", "1d")

    symbols = _parse_symbols(raw)
    if not symbols:
        raise ValueError("universe: `symbol` is empty — provide at least one ticker")

    per_ticker: dict[str, pd.DataFrame] = {}
    failures: list[str] = []

    for sym in symbols:
        try:
            df = yf.download(
                sym,
                start=start,
                end=end,
                interval=interval,
                auto_adjust=True,
                progress=False,
            )
        except Exception as e:  # pragma: no cover - yfinance network errors
            failures.append(f"{sym}: {e}")
            continue
        if df is None or df.empty:
            failures.append(f"{sym}: empty response")
            continue
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.dropna(how="all")
        df.index = pd.DatetimeIndex(df.index)
        df.index.name = "Date"
        per_ticker[sym] = df

    if not per_ticker:
        raise ValueError(
            f"yfinance returned no data for any of {symbols}. "
            f"Failures: {failures or '(unknown)'}"
        )

    primary_sym = next(iter(per_ticker.keys()))
    primary_df = per_ticker[primary_sym]

    metadata = {
        "symbol": primary_sym,
        "symbols_requested": symbols,
        "tickers": list(per_ticker.keys()),
        "start": start,
        "end": end,
        "row_count": int(len(primary_df)),
        "nan_count_per_column": {c: int(primary_df[c].isna().sum()) for c in primary_df.columns},
        "date_range": (
            str(primary_df.index[0].date()),
            str(primary_df.index[-1].date()),
        ),
        "per_ticker": per_ticker if len(per_ticker) > 1 else None,
        "failures": failures,
    }
    return {"df": primary_df, "metadata": metadata}


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
