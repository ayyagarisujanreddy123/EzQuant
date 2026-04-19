"""
Position sizing — turn a real-valued signal into a discrete position series.
"""
import pandas as pd


def position_sizer(inputs: dict, params: dict) -> dict:
    """
    Add a 'position' column in {-1, 0, +1} based on signal thresholds.

    mode='threshold'  : +1 if signal > upper, -1 if signal < lower, else 0.
    mode='vol_target' : not implemented in MVP (raises NotImplementedError).
    """
    df = inputs["df"].copy()
    mode = params.get("mode", "threshold")
    if mode == "vol_target":
        raise NotImplementedError(
            "position_sizer mode='vol_target' is not implemented in the MVP"
        )
    if mode != "threshold":
        raise ValueError(f"mode must be 'threshold' or 'vol_target', got {mode!r}")

    # If upstream didn't insert an explicit Signal block, auto-pick a feature.
    if "signal" not in df.columns:
        candidates = [c for c in df.columns if c.startswith(("ema_", "momentum_"))]
        if not candidates:
            raise ValueError(
                "position_sizer: no 'signal' column and no ema_* / momentum_* "
                "column found. Insert a Signal block upstream."
            )
        df["signal"] = df[candidates[0]]

    upper = float(params.get("upper_threshold", 0))
    lower = float(params.get("lower_threshold", 0))

    sig = df["signal"]
    pos = pd.Series(0, index=df.index, dtype="int64")
    pos[sig > upper] = 1
    pos[sig < lower] = -1
    df["position"] = pos
    return {"df": df}
