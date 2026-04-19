"""
Backtest — realize pnl from (position, return) with a strict lookahead guard.
"""
import numpy as np


def backtest(inputs: dict, params: dict) -> dict:
    """
    Compute pnl, equity curve, and performance metrics.

    Lookahead guard: pnl_t = position_{t-1} * return_t. The shift(1) is
    non-negotiable — you decide the position using information up to t-1,
    then earn that day's return at t. Without it, backtests "predict" the
    same day's return and look spectacular for no real reason.
    """
    df = inputs["df"].copy()
    return_col = params.get("return_column", "log_return")
    cost_bps = float(params.get("cost_bps", 0.0))

    if "position" not in df.columns:
        raise ValueError("Input DataFrame must contain a 'position' column")
    if return_col not in df.columns:
        raise ValueError(f"Return column {return_col!r} not in DataFrame {list(df.columns)}")

    # Lookahead guard: yesterday's position times today's return.
    raw_pnl = df["position"].shift(1) * df[return_col]
    pos_change = df["position"].diff().abs().fillna(0)
    cost = pos_change * (cost_bps / 10000.0)
    pnl = (raw_pnl - cost).fillna(0)
    equity = (1 + pnl).cumprod()

    df["pnl"] = pnl
    df["position_change"] = pos_change
    df["equity"] = equity

    mean_pnl = pnl.mean()
    std_pnl = pnl.std()
    sharpe = float(mean_pnl / std_pnl * np.sqrt(252)) if std_pnl > 0 else float("nan")
    total_return = float(equity.iloc[-1] - 1) if len(equity) > 0 else 0.0

    running_max = equity.cummax()
    drawdown = equity / running_max - 1
    max_drawdown = float(drawdown.min()) if len(drawdown) > 0 else 0.0

    nonzero = pnl[pnl != 0]
    hit_rate = float((nonzero > 0).mean()) if len(nonzero) > 0 else float("nan")

    n_trades = int((pos_change > 0).sum())
    bars_held = int((df["position"] != 0).sum())
    avg_holding_period = float(bars_held / n_trades) if n_trades > 0 else float("nan")

    metrics = {
        "sharpe": sharpe,
        "total_return": total_return,
        "max_drawdown": max_drawdown,
        "hit_rate": hit_rate,
        "n_trades": n_trades,
        "avg_holding_period": avg_holding_period,
    }
    return {"df": df, "metrics": metrics}
