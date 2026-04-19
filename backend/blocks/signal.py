"""
Signal blocks — pin a column as the signal, then measure its IC.

`signal_diagnostics` is the keystone block of the whole research framework:
Information Coefficient (IC) is the correlation between a signal and its
forward return, and it is what tells us whether a signal is worth backtesting.
"""
import numpy as np
import pandas as pd
from scipy.stats import spearmanr


def signal(inputs: dict, params: dict) -> dict:
    """
    Copy `params['column']` to a new 'signal' column.

    No math — this block exists purely to make "what is my signal?" a deliberate
    choice so every downstream block can rely on df['signal'] existing.
    """
    df = inputs["df"].copy()
    column = params.get("column")
    if not column:
        # Fall back to any ema_* / momentum_* column if the user didn't set one.
        candidates = [c for c in df.columns if c.startswith(("ema_", "momentum_"))]
        if not candidates:
            raise ValueError(
                f"signal: no 'column' param and no ema_* / momentum_* column found in {list(df.columns)}"
            )
        column = candidates[0]
    name = params.get("name") or column
    if column not in df.columns:
        raise ValueError(f"Column {column!r} not in DataFrame {list(df.columns)}")
    df["signal"] = df[column]
    return {
        "df": df,
        "metadata": {"signal_source_column": column, "signal_name": name},
    }


def _corr(a, b, ic_type: str) -> float:
    if ic_type == "spearman":
        r, _ = spearmanr(a, b)
    elif ic_type == "pearson":
        r = pd.Series(a).corr(pd.Series(b), method="pearson")
    else:
        raise ValueError(f"ic_type must be 'spearman' or 'pearson', got {ic_type!r}")
    return float(r) if pd.notna(r) else float("nan")


def signal_diagnostics(inputs: dict, params: dict) -> dict:
    """
    Compute Information Coefficient (IC) and related diagnostics.

    IC is the correlation between a signal and its forward return — the
    keystone test of whether a signal has predictive content before you
    spend time on a backtest.
    """
    sig_df = inputs.get("signal_df")
    fr_df = inputs.get("forward_return_df")
    if sig_df is None or fr_df is None:
        raise ValueError("signal_diagnostics requires 'signal_df' and 'forward_return_df'")

    ic_type = params.get("ic_type", "spearman")
    horizons = params.get("horizons", [1, 2, 5, 10, 20])
    fr_col = params.get("forward_return_column", "forward_return_1")

    joined = sig_df if sig_df is fr_df else sig_df.join(fr_df, how="inner", rsuffix="_fr")
    if "signal" not in joined.columns:
        raise ValueError("signal_df must contain a 'signal' column")
    if fr_col not in joined.columns:
        alt = f"{fr_col}_fr"
        if alt in joined.columns:
            fr_col = alt
        else:
            raise ValueError(f"forward_return_df must contain column {fr_col!r}")

    pair = joined[["signal", fr_col]].dropna()
    n = int(len(pair))
    metadata: dict = {}

    if n < 30:
        ic, ic_tstat = float("nan"), float("nan")
        metadata["warning"] = f"n={n} < 30; IC set to NaN"
    else:
        ic = _corr(pair["signal"], pair[fr_col], ic_type)
        ic_tstat = ic * np.sqrt(n - 2) / np.sqrt(max(1 - ic * ic, 1e-12))
        ic_tstat = float(ic_tstat) if pd.notna(ic_tstat) else float("nan")

    # IC decay — compute forward return at each horizon on the fly from Close
    # if available, otherwise fall back to shifting the supplied fr column.
    ic_decay: dict = {}
    price_col = "Close" if "Close" in joined.columns else None
    for k in horizons:
        existing = f"forward_return_{k}"
        if existing in joined.columns:
            fr_k = joined[existing]
        elif price_col is not None:
            fr_k = np.log(joined[price_col].shift(-k) / joined[price_col])
        else:
            fr_k = joined[fr_col].shift(-(k - 1))
        pair_k = pd.concat([joined["signal"], fr_k], axis=1).dropna()
        if len(pair_k) < 30:
            ic_decay[int(k)] = float("nan")
        else:
            ic_decay[int(k)] = _corr(pair_k.iloc[:, 0], pair_k.iloc[:, 1], ic_type)

    # Monthly IC stability — keyed by "YYYY-MM".
    ic_stability: dict = {}
    for period, g in pair.groupby(pair.index.to_period("M")):
        ic_stability[str(period)] = (
            _corr(g["signal"], g[fr_col], ic_type) if len(g) >= 5 else float("nan")
        )

    sig = joined["signal"].dropna()
    signal_autocorr = float(sig.corr(sig.shift(1))) if len(sig) > 1 else float("nan")

    metrics = {
        "ic": ic,
        "ic_tstat": ic_tstat,
        "n": n,
        "ic_decay": ic_decay,
        "ic_stability": ic_stability,
        "signal_autocorr": signal_autocorr,
    }
    return {"df": joined, "metrics": metrics, "metadata": metadata}
