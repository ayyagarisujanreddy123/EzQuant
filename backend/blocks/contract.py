"""
Uniform block contract for SignalTracer computational blocks.

Every block is a pure function: f(inputs: dict, params: dict) -> dict.
The dict always has at least a "df" key; diagnostic blocks add "metrics",
and any block may attach "metadata" for provenance / warnings.
"""
from typing import TypedDict

import pandas as pd


class BlockOutput(TypedDict, total=False):
    df: pd.DataFrame
    metrics: dict
    metadata: dict
