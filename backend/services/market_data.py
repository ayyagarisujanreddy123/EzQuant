"""
Market data service.
 
Architecture:
    MarketDataProvider  (abstract interface — easy to add providers later)
         ^
         |
    YFinanceProvider    (concrete impl)
 
    MarketDataService(provider=yf)  <-- adds TTL caching on top
 
Retry discipline:
  YFinanceProvider wraps its fetch in a small retry loop with backoff. This
  handles the typical "Yahoo returned HTML once, JSON parse failed" case
  ("Expecting value: line 1 column 1 (char 0)") that yfinance hits when
  Yahoo is rate-limiting or serving a block page.
 
Typed errors:
  * EmptyDataError  -> route returns 404 (symbol probably bad)
  * MarketDataError -> route returns 502 (infra broken)
"""
from __future__ import annotations
 
import logging
import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import List, Optional, Tuple
 
import pandas as pd
import yfinance as yf
from cachetools import TTLCache
 
from backend.core.config import get_settings
from backend.schemas.market import (
    Interval,
    OHLCVBar,
    OHLCVResponse,
    Period,
    TickerSearchResult,
)
 
logger = logging.getLogger(__name__)
 
 
# --------------------------------------------------------------------------- #
# Interval classification — determines which cache TTL to use.
# --------------------------------------------------------------------------- #
 
_INTRADAY_INTERVALS = {"1m", "2m", "5m", "15m", "30m", "60m", "90m", "1h"}
 
 
def _is_intraday(interval: Interval) -> bool:
    return interval in _INTRADAY_INTERVALS
 
 
# --------------------------------------------------------------------------- #
# Exceptions
# --------------------------------------------------------------------------- #
 
class MarketDataError(Exception):
    """Raised when a provider cannot produce data (after retries)."""
 
 
class EmptyDataError(MarketDataError):
    """Provider returned OK but zero bars — treat differently (404 vs 502)."""
 
 
# --------------------------------------------------------------------------- #
# Abstract provider interface
# --------------------------------------------------------------------------- #
 
class MarketDataProvider(ABC):
    """Any provider we swap in must implement these two methods."""
 
    name: str  # e.g. "yfinance"
 
    @abstractmethod
    def search_tickers(self, query: str, limit: int = 10) -> List[TickerSearchResult]:
        ...
 
    @abstractmethod
    def get_ohlcv(
        self,
        symbol: str,
        interval: Interval,
        period: Optional[Period] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> OHLCVResponse:
        ...
 
 
# --------------------------------------------------------------------------- #
# Curated popular tickers for autocomplete.
# --------------------------------------------------------------------------- #
 
POPULAR_TICKERS: List[TickerSearchResult] = [
    # Mega-cap equities
    TickerSearchResult(symbol="AAPL", name="Apple Inc.",            exchange="NMS", asset_type="EQUITY"),
    TickerSearchResult(symbol="MSFT", name="Microsoft Corporation", exchange="NMS", asset_type="EQUITY"),
    TickerSearchResult(symbol="GOOGL", name="Alphabet Inc. Class A", exchange="NMS", asset_type="EQUITY"),
    TickerSearchResult(symbol="AMZN", name="Amazon.com, Inc.",      exchange="NMS", asset_type="EQUITY"),
    TickerSearchResult(symbol="NVDA", name="NVIDIA Corporation",    exchange="NMS", asset_type="EQUITY"),
    TickerSearchResult(symbol="META", name="Meta Platforms, Inc.",  exchange="NMS", asset_type="EQUITY"),
    TickerSearchResult(symbol="TSLA", name="Tesla, Inc.",           exchange="NMS", asset_type="EQUITY"),
    TickerSearchResult(symbol="JPM",  name="JPMorgan Chase & Co.",  exchange="NYQ", asset_type="EQUITY"),
    TickerSearchResult(symbol="V",    name="Visa Inc.",             exchange="NYQ", asset_type="EQUITY"),
    TickerSearchResult(symbol="WMT",  name="Walmart Inc.",          exchange="NYQ", asset_type="EQUITY"),
 
    # Broad-market ETFs
    TickerSearchResult(symbol="SPY",  name="SPDR S&P 500 ETF Trust",        exchange="PCX", asset_type="ETF"),
    TickerSearchResult(symbol="QQQ",  name="Invesco QQQ Trust",              exchange="NMS", asset_type="ETF"),
    TickerSearchResult(symbol="IWM",  name="iShares Russell 2000 ETF",       exchange="PCX", asset_type="ETF"),
    TickerSearchResult(symbol="VTI",  name="Vanguard Total Stock Market ETF",exchange="PCX", asset_type="ETF"),
    TickerSearchResult(symbol="DIA",  name="SPDR Dow Jones Industrial Avg",  exchange="PCX", asset_type="ETF"),
 
    # Sector / thematic
    TickerSearchResult(symbol="XLK",  name="Technology Select Sector SPDR",  exchange="PCX", asset_type="ETF"),
    TickerSearchResult(symbol="XLF",  name="Financial Select Sector SPDR",   exchange="PCX", asset_type="ETF"),
    TickerSearchResult(symbol="XLE",  name="Energy Select Sector SPDR",      exchange="PCX", asset_type="ETF"),
 
    # Indices
    TickerSearchResult(symbol="^GSPC", name="S&P 500 Index",                 exchange="SNP", asset_type="INDEX"),
    TickerSearchResult(symbol="^IXIC", name="NASDAQ Composite Index",        exchange="NIM", asset_type="INDEX"),
    TickerSearchResult(symbol="^DJI",  name="Dow Jones Industrial Average",  exchange="DJI", asset_type="INDEX"),
    TickerSearchResult(symbol="^VIX",  name="CBOE Volatility Index",         exchange="CBO", asset_type="INDEX"),
 
    # Crypto (yfinance uses the -USD suffix)
    TickerSearchResult(symbol="BTC-USD", name="Bitcoin USD", exchange="CCC", asset_type="CRYPTOCURRENCY"),
    TickerSearchResult(symbol="ETH-USD", name="Ethereum USD", exchange="CCC", asset_type="CRYPTOCURRENCY"),
]
 
 
def _search_popular(query: str, limit: int) -> List[TickerSearchResult]:
    """Ranked substring search over the curated list."""
    if not query:
        return POPULAR_TICKERS[:limit]
 
    q = query.strip().upper()
    starts_with, contains_sym, contains_name = [], [], []
    for t in POPULAR_TICKERS:
        sym_u = t.symbol.upper()
        name_u = t.name.upper()
        if sym_u.startswith(q):
            starts_with.append(t)
        elif q in sym_u:
            contains_sym.append(t)
        elif q in name_u:
            contains_name.append(t)
    return (starts_with + contains_sym + contains_name)[:limit]
 
 
# --------------------------------------------------------------------------- #
# yfinance provider
# --------------------------------------------------------------------------- #
 
class YFinanceProvider(MarketDataProvider):
    name = "yfinance"
 
    def __init__(self, max_retries: int = 2, retry_backoff_seconds: float = 1.5):
        self.max_retries = max_retries
        self.retry_backoff_seconds = retry_backoff_seconds
 
    def search_tickers(self, query: str, limit: int = 10) -> List[TickerSearchResult]:
        ranked = _search_popular(query, limit)
        if ranked or not query:
            return ranked
 
        # Fallback: resolve symbols we don't have curated via yfinance .info.
        # This call is the most fragile in yfinance — wrap it carefully.
        try:
            info = yf.Ticker(query.strip().upper()).info
            if info and info.get("symbol"):
                return [TickerSearchResult(
                    symbol=info.get("symbol", query.upper()),
                    name=info.get("shortName") or info.get("longName") or query.upper(),
                    exchange=info.get("exchange"),
                    asset_type=info.get("quoteType"),
                )]
        except Exception as e:
            logger.warning("yfinance fallback lookup failed for %s: %s", query, e)
 
        return []
 
    def get_ohlcv(
        self,
        symbol: str,
        interval: Interval,
        period: Optional[Period] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> OHLCVResponse:
        """
        Fetch OHLCV from yfinance with retry. The typical failure is:
            "Expecting value: line 1 column 1 (char 0)"
        which means Yahoo served an HTML block/rate-limit page instead of JSON.
        A short sleep + retry usually clears it.
        """
        last_exc: Optional[Exception] = None
 
        for attempt in range(self.max_retries + 1):
            try:
                ticker = yf.Ticker(symbol)
                if period is not None:
                    df = ticker.history(period=period, interval=interval, auto_adjust=False)
                else:
                    df = ticker.history(start=start, end=end, interval=interval, auto_adjust=False)
 
                bars = self._dataframe_to_bars(df)
                if bars:
                    return OHLCVResponse(
                        symbol=symbol.upper(),
                        interval=interval,
                        period=period,
                        start=start,
                        end=end,
                        bars=bars,
                        bar_count=len(bars),
                        source=self.name,
                        retrieved_at=datetime.now(timezone.utc),
                        cache_hit=False,
                    )
 
                logger.warning(
                    "yfinance returned empty bars for %s %s (attempt %d/%d)",
                    symbol, interval, attempt + 1, self.max_retries + 1,
                )
            except Exception as e:
                last_exc = e
                logger.warning(
                    "yfinance error for %s %s (attempt %d/%d): %s",
                    symbol, interval, attempt + 1, self.max_retries + 1, e,
                )
 
            if attempt < self.max_retries:
                time.sleep(self.retry_backoff_seconds * (attempt + 1))
 
        if last_exc is not None:
            raise MarketDataError(f"yfinance failed after retries: {last_exc}") from last_exc
        raise EmptyDataError(f"yfinance returned no bars for {symbol} {interval} after retries")
 
    @staticmethod
    def _dataframe_to_bars(df: pd.DataFrame) -> List[OHLCVBar]:
        if df is None or df.empty:
            return []
 
        if df.index.tz is None:
            idx = df.index.tz_localize("UTC")
        else:
            idx = df.index.tz_convert("UTC")
 
        bars: List[OHLCVBar] = []
        has_adj = "Adj Close" in df.columns
 
        for i, ts in enumerate(idx):
            row = df.iloc[i]
            if pd.isna(row["Open"]) and pd.isna(row["Close"]):
                continue
            bars.append(OHLCVBar(
                timestamp=ts.to_pydatetime(),
                open=float(row["Open"]),
                high=float(row["High"]),
                low=float(row["Low"]),
                close=float(row["Close"]),
                volume=float(row["Volume"]) if not pd.isna(row["Volume"]) else 0.0,
                adj_close=float(row["Adj Close"]) if has_adj and not pd.isna(row["Adj Close"]) else None,
            ))
        return bars
 
 
# --------------------------------------------------------------------------- #
# Cached facade — what API routes actually call.
# --------------------------------------------------------------------------- #
 
class MarketDataService:
    """Thin caching layer on top of a provider. API routes only talk to this."""
 
    def __init__(self, provider: MarketDataProvider):
        self.provider = provider
        settings = get_settings()
        self._cache_intraday: TTLCache = TTLCache(maxsize=512, ttl=settings.market_cache_ttl_intraday)
        self._cache_daily: TTLCache = TTLCache(maxsize=512, ttl=settings.market_cache_ttl_daily)
        self._cache_search: TTLCache = TTLCache(maxsize=256, ttl=300)
 
    def search_tickers(self, query: str, limit: int = 10):
        key = (query.strip().lower(), limit)
        if key in self._cache_search:
            return self._cache_search[key]
        results = self.provider.search_tickers(query, limit=limit)
        self._cache_search[key] = results
        return results
 
    def get_ohlcv(
        self,
        symbol: str,
        interval: Interval,
        period: Optional[Period] = None,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
    ) -> OHLCVResponse:
        cache, key = self._ohlcv_cache_and_key(symbol, interval, period, start, end)
 
        if key in cache:
            cached: OHLCVResponse = cache[key]
            return cached.model_copy(update={"cache_hit": True})
 
        response = self.provider.get_ohlcv(symbol, interval, period=period, start=start, end=end)
        cache[key] = response
        return response
 
    def _ohlcv_cache_and_key(
        self,
        symbol: str,
        interval: Interval,
        period: Optional[Period],
        start: Optional[datetime],
        end: Optional[datetime],
    ) -> Tuple[TTLCache, tuple]:
        cache = self._cache_intraday if _is_intraday(interval) else self._cache_daily
        key = (
            symbol.upper(),
            interval,
            period,
            start.isoformat() if start else None,
            end.isoformat() if end else None,
        )
        return cache, key
 
 
# --------------------------------------------------------------------------- #
# FastAPI dependency
# --------------------------------------------------------------------------- #
 
_service: Optional[MarketDataService] = None
 
def get_market_data_service() -> MarketDataService:
    """Lazy singleton. Built on first request, reused after."""
    global _service
    if _service is not None:
        return _service
 
    settings = get_settings()
    provider = YFinanceProvider(
        max_retries=settings.yfinance_max_retries,
        retry_backoff_seconds=settings.yfinance_retry_backoff_seconds,
    )
    _service = MarketDataService(provider=provider)
    return _service

def to_dataframe(response: OHLCVResponse) -> pd.DataFrame:
    """
    Convert an OHLCVResponse into a pandas DataFrame indexed by timestamp
    (UTC), with columns: open, high, low, close, volume, adj_close.
    """
    if not response.bars:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume", "adj_close"])
 
    df = pd.DataFrame([{
        "timestamp": b.timestamp,
        "open": b.open,
        "high": b.high,
        "low": b.low,
        "close": b.close,
        "volume": b.volume,
        "adj_close": b.adj_close,
    } for b in response.bars])
    df = df.set_index("timestamp").sort_index()
    return df
