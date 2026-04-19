"""
EzQuant block registry.

The canvas executor looks up blocks by string name from BLOCK_REGISTRY and
calls them with the uniform contract: f(inputs: dict, params: dict) -> dict.
Every block returns a dict with at least a 'df' key.
"""
from backend.blocks.backtest import backtest
from backend.blocks.contract import BlockOutput
from backend.blocks.features import ema, momentum
from backend.blocks.position import position_sizer
from backend.blocks.signal import signal, signal_diagnostics
from backend.blocks.source import csv_upload, universe
from backend.blocks.transforms import forward_return, log_returns

BLOCK_REGISTRY = {
    "universe": universe,
    "csv_upload": csv_upload,
    "log_returns": log_returns,
    "forward_return": forward_return,
    "ema": ema,
    "momentum": momentum,
    "signal": signal,
    "signal_diagnostics": signal_diagnostics,
    "position_sizer": position_sizer,
    "backtest": backtest,
}

__all__ = ["BLOCK_REGISTRY", "BlockOutput"]
