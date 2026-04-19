"""
Signal blocks — pin a column as the signal, then measure its IC.

`signal_diagnostics` implements **cross-sectional IC (CS-IC)** for multi-asset
panels. At each timestamp t:

    rank_signal_t   = rank(signal across all assets at t)
    rank_fwd_t      = rank(forward_return across all assets at t)
    IC_t            = corr(rank_signal_t, rank_fwd_t)   # Spearman by default

Mean IC across t is the headline. t-stat, monthly stability, IC decay at
multiple horizons, and period-over-period rank-vector autocorrelation are
also computed. This is the research-grade IC framework used at HRT / Two
Sigma / López de Prado-style workflows.

Legacy single-ticker input is still supported (for the 3 sanity tests) and
degrades to the older time-series IC. The pipeline runner blocks single-
ticker use at the UI boundary with a clear error.
"""
from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import pandas as pd
from scipy.stats import spearmanr


# ─── signal — unchanged ──────────────────────────────────────────────────────


def signal(inputs: dict, params: dict) -> dict:
    """
    Copy `params['column']` to a new 'signal' column.

    No math — this block exists purely to make "what is my signal?" a deliberate
    choice so every downstream block can rely on df['signal'] existing.
    """
    df = inputs["df"].copy()
    column = params.get("column")
    if not column:
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


# ─── signal_diagnostics (CS-IC) ──────────────────────────────────────────────


def _corr(a: pd.Series, b: pd.Series, ic_type: str) -> float:
    if len(a) < 2 or len(b) < 2:
        return float("nan")
    if ic_type == "pearson":
        r = a.corr(b, method="pearson")
    else:
        r, _ = spearmanr(a, b)
    return float(r) if pd.notna(r) else float("nan")


def _panel_df_from_inputs(inputs: dict) -> Dict[str, pd.DataFrame] | None:
    """
    Pull a cross-sectional panel out of `inputs`. The pipeline runner injects
    `panel_signal_df` + `panel_forward_return_df` in multi-ticker mode.
    """
    panel_sig = inputs.get("panel_signal_df")
    panel_fr = inputs.get("panel_forward_return_df")
    if not isinstance(panel_sig, dict) or not isinstance(panel_fr, dict):
        return None
    if not panel_sig:
        return None
    # Build per-ticker df where each has signal + fr column. The runner sets
    # them equal (shared upstream df) for MVP single-branch pipelines.
    merged: Dict[str, pd.DataFrame] = {}
    for ticker, sig_df in panel_sig.items():
        fr_df = panel_fr.get(ticker, sig_df)
        # If shared df, just use it. Else join.
        if sig_df is fr_df:
            merged[ticker] = sig_df
        else:
            merged[ticker] = sig_df.join(fr_df, how="inner", rsuffix="_fr")
    return merged


def _cross_sectional_diagnostics(
    panel: Dict[str, pd.DataFrame],
    ic_type: str,
    horizons: List[int],
    fr_col: str,
) -> dict:
    """Core CS-IC calculation given {ticker: df} panel."""
    warnings: List[str] = []

    # Collect signal + fr into wide tables: rows=dates, cols=tickers.
    sig_wide = pd.DataFrame({t: d["signal"] for t, d in panel.items() if "signal" in d.columns}).sort_index()
    if sig_wide.empty:
        raise ValueError("No ticker contained a 'signal' column — upstream Signal block missing?")
    fr_wide = pd.DataFrame(
        {t: d[fr_col] for t, d in panel.items() if fr_col in d.columns}
    ).sort_index()
    if fr_wide.empty:
        raise ValueError(
            f"No ticker contained forward-return column {fr_col!r}. "
            "Wire a Forward Return block upstream or set `forward_return_column` to the correct name."
        )

    # Align tickers + timestamps.
    common_tickers = sorted(set(sig_wide.columns) & set(fr_wide.columns))
    if len(common_tickers) < 2:
        raise ValueError(
            f"Only {len(common_tickers)} ticker(s) have both signal and {fr_col!r}. "
            "Cross-sectional IC needs ≥ 2 tickers."
        )
    sig_wide = sig_wide[common_tickers]
    fr_wide = fr_wide[common_tickers]
    common_index = sig_wide.index.intersection(fr_wide.index)
    sig_wide = sig_wide.loc[common_index]
    fr_wide = fr_wide.loc[common_index]

    # IC per timestamp.
    ic_records: List[tuple] = []
    short_t_count = 0
    for ts in common_index:
        sig_row = sig_wide.loc[ts].dropna()
        fr_row = fr_wide.loc[ts].reindex(sig_row.index).dropna()
        common_cols = sig_row.index.intersection(fr_row.index)
        n_t = len(common_cols)
        if n_t < 2:
            continue
        if n_t < 5:
            short_t_count += 1
        a = sig_row.loc[common_cols]
        b = fr_row.loc[common_cols]
        ic_t = _corr(a, b, ic_type)
        if pd.notna(ic_t):
            ic_records.append((ts, ic_t, n_t))

    if short_t_count:
        warnings.append(
            f"{short_t_count} timestamp(s) computed IC with < 5 tickers "
            "(recommend ≥ 5 for a stable ranking)."
        )

    if len(ic_records) < 2:
        raise ValueError(
            f"Only {len(ic_records)} valid timestamp(s) for CS-IC. "
            "Need ≥ 2 timestamps where at least 2 tickers have both signal and forward return."
        )

    ic_index = pd.DatetimeIndex([r[0] for r in ic_records])
    ic_values = pd.Series([r[1] for r in ic_records], index=ic_index, name="ic")
    n_tickers_per_t = pd.Series([r[2] for r in ic_records], index=ic_index, name="n_tickers")

    T = int(len(ic_values))
    mean_ic = float(ic_values.mean())
    std_ic = float(ic_values.std()) if T > 1 else float("nan")
    ic_tstat = float(mean_ic * np.sqrt(T) / std_ic) if std_ic and std_ic > 0 else float("nan")

    if T < 30:
        warnings.append(f"T={T} timestamps < 30 — IC estimate may be noisy.")

    # Monthly stability — mean IC per YYYY-MM bucket.
    ic_stability: Dict[str, float] = {}
    for period, group in ic_values.groupby(ic_values.index.to_period("M")):
        ic_stability[str(period)] = float(group.mean()) if len(group) >= 2 else float("nan")

    # IC decay — recompute CS-IC at each horizon from Close prices if available.
    ic_decay: Dict[int, float] = {}
    close_wide = None
    if all("Close" in d.columns for d in panel.values()):
        close_wide = pd.DataFrame({t: d["Close"] for t, d in panel.items()}).sort_index()
        close_wide = close_wide[common_tickers]

    for h in horizons:
        horizon_ic: List[float] = []
        if close_wide is not None:
            fr_h = np.log(close_wide.shift(-int(h)) / close_wide)
        else:
            # Fallback: shift the supplied fr column by (h-1) bars.
            fr_h = fr_wide.shift(-(int(h) - 1))
        fr_h = fr_h.reindex(sig_wide.index)
        for ts in sig_wide.index:
            sig_row = sig_wide.loc[ts].dropna()
            fr_row = fr_h.loc[ts].reindex(sig_row.index).dropna()
            common_cols = sig_row.index.intersection(fr_row.index)
            if len(common_cols) < 2:
                continue
            v = _corr(sig_row.loc[common_cols], fr_row.loc[common_cols], ic_type)
            if pd.notna(v):
                horizon_ic.append(v)
        ic_decay[int(h)] = float(np.mean(horizon_ic)) if len(horizon_ic) >= 2 else float("nan")

    # Rank autocorrelation — period-over-period Spearman between rank vectors.
    # Tells us how much the cross-section reshuffles bar-to-bar (low autocorr
    # = high turnover).
    method_for_autocorr = "pearson" if ic_type == "pearson" else "spearman"
    rank_autocorrs: List[float] = []
    prev_row: pd.Series | None = None
    for ts in sig_wide.index:
        row = sig_wide.loc[ts].dropna()
        if len(row) < 2:
            prev_row = row if len(row) >= 2 else prev_row
            continue
        if prev_row is not None:
            common_cols = row.index.intersection(prev_row.index)
            if len(common_cols) >= 2:
                r_val = _corr(
                    row.loc[common_cols].rank(method="average"),
                    prev_row.loc[common_cols].rank(method="average"),
                    method_for_autocorr,
                )
                if pd.notna(r_val):
                    rank_autocorrs.append(r_val)
        prev_row = row
    rank_autocorr = float(np.mean(rank_autocorrs)) if rank_autocorrs else float("nan")

    # Build the output df so Inspector can plot the IC_t series.
    out_df = pd.DataFrame(
        {
            "ic": ic_values,
            "n_tickers": n_tickers_per_t,
        }
    )

    metrics = {
        "ic": mean_ic,
        "ic_tstat": ic_tstat,
        "n": T,
        "n_tickers": int(len(common_tickers)),
        "ic_decay": ic_decay,
        "ic_stability": ic_stability,
        "signal_autocorr": rank_autocorr,
        "ic_std": std_ic,
    }
    metadata = {
        "tickers": common_tickers,
        "date_range": (str(ic_values.index[0].date()), str(ic_values.index[-1].date()))
        if T > 0 else (None, None),
        "warnings": warnings,
        "mode": "cross_sectional",
    }
    return {"df": out_df, "metrics": metrics, "metadata": metadata}


def _time_series_diagnostics(
    sig_df: pd.DataFrame,
    fr_df: pd.DataFrame,
    ic_type: str,
    horizons: List[int],
    fr_col: str,
) -> dict:
    """
    Legacy single-ticker IC — kept so the 3 block-level sanity tests keep
    working. Not exposed to end users; runner raises if they wire single-ticker.
    """
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
    metadata: dict = {"mode": "time_series"}

    if n < 30:
        ic, ic_tstat = float("nan"), float("nan")
        metadata["warning"] = f"n={n} < 30; IC set to NaN"
    else:
        ic = _corr(pair["signal"], pair[fr_col], ic_type)
        ic_tstat = ic * np.sqrt(n - 2) / np.sqrt(max(1 - ic * ic, 1e-12))
        ic_tstat = float(ic_tstat) if pd.notna(ic_tstat) else float("nan")

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
        ic_decay[int(k)] = (
            _corr(pair_k.iloc[:, 0], pair_k.iloc[:, 1], ic_type)
            if len(pair_k) >= 30 else float("nan")
        )

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


def signal_diagnostics(inputs: dict, params: dict) -> dict:
    """
    Cross-sectional IC diagnostics across multiple tickers.

    Inputs:
      - panel_signal_df / panel_forward_return_df (preferred) — {ticker: df}
      - signal_df / forward_return_df (legacy, single-ticker) — falls back to
        the older time-series IC logic so sanity tests keep passing.

    Params:
      - ic_type: 'spearman' (default) or 'pearson'
      - horizons: list[int], default [1,2,5,10,20]
      - forward_return_column: str, default 'forward_return_1'
    """
    ic_type = params.get("ic_type", "spearman")
    horizons: List[int] = params.get("horizons", [1, 2, 5, 10, 20])
    fr_col = params.get("forward_return_column", "forward_return_1")

    panel = _panel_df_from_inputs(inputs)
    if panel is not None and len(panel) >= 2:
        return _cross_sectional_diagnostics(panel, ic_type, horizons, fr_col)

    sig_df = inputs.get("signal_df")
    fr_df = inputs.get("forward_return_df")
    if sig_df is None or fr_df is None:
        raise ValueError(
            "signal_diagnostics requires either a multi-ticker panel or "
            "single-ticker (signal_df, forward_return_df) inputs."
        )
    return _time_series_diagnostics(sig_df, fr_df, ic_type, horizons, fr_col)
