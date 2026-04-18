"""
Pydantic schemas for the market data API.

Design principle: the frontend sees ONE schema regardless of whether the data
came from yfinance, Polygon, Alpaca, or a cache. This is the "normalization layer"
the HRT blog would call out as good hygiene — provenance and schema are fixed.

If we later swap providers, only app/services/market_data.py changes. The frontend
and the rest of the backend don't care.
"""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


# --- Canonical enums (keep these narrow so the UI can render dropdowns easily) ---

Interval = Literal[
    "1m", "2m", "5m", "15m", "30m", "60m", "90m",
    "1h", "1d", "5d", "1wk", "1mo", "3mo",
]
# yfinance intraday (1m-90m) is limited to the last ~7-60 days depending on interval.
# The frontend should surface this; we validate in the service layer.

Period = Literal[
    "1d", "5d", "1mo", "3mo", "6mo",
    "1y", "2y", "5y", "10y", "ytd", "max",
]


# --- Ticker search ---

class TickerSearchResult(BaseModel):
    """One row in an autocomplete dropdown."""
    symbol: str = Field(..., examples=["AAPL"])
    name: str = Field(..., examples=["Apple Inc."])
    exchange: Optional[str] = Field(None, examples=["NMS"])
    asset_type: Optional[str] = Field(None, examples=["EQUITY", "ETF", "INDEX", "CRYPTOCURRENCY"])


class TickerSearchResponse(BaseModel):
    query: str
    results: List[TickerSearchResult]


# --- OHLCV bars ---

class OHLCVBar(BaseModel):
    """One candle. All timestamps are UTC ISO-8601."""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float  # float (not int) because adjusted volume can be fractional for some providers

    # Adjusted close is optional — providers differ on whether/how they adjust for splits & dividends.
    adj_close: Optional[float] = None


class OHLCVResponse(BaseModel):
    """
    The canonical OHLCV payload.

    Every response carries provenance so downstream code (and the agent, later)
    knows exactly where the data came from and when it was retrieved. This is the
    "garbage in, garbage out" discipline applied at the API boundary.
    """
    symbol: str
    interval: Interval
    period: Optional[Period] = None
    start: Optional[datetime] = None
    end: Optional[datetime] = None

    bars: List[OHLCVBar]
    bar_count: int

    # Provenance
    source: str = Field(..., examples=["yfinance"])
    retrieved_at: datetime
    cache_hit: bool = False


# --- Errors ---

class APIError(BaseModel):
    error: str
    detail: Optional[str] = None


# --- Health ---

class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"] = "ok"
    service: str = "ezquant-backend"
    version: str = "0.1.0"
    timestamp: datetime
    env: str
