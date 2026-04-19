"""
Market data routes.
 
Two endpoints, each doing one thing well:
 
  GET /api/market/search?q=...&limit=10
      Autocomplete-friendly ticker search. Returns symbol/name/exchange/type.
 
  GET /api/market/ohlcv?symbol=NVDA&interval=1d&period=1mo
      Normalized OHLCV bars. Supports EITHER `period` (convenience) OR
      `start`+`end` (precision). Rejects both-at-once.
 
Design notes:
  - Both endpoints are GET so they're trivially cacheable at the HTTP layer if
    you put Cloudflare / a CDN in front later.
  - Validation happens at the Pydantic layer (Query types), which means FastAPI
    auto-generates a crisp OpenAPI doc at /docs. The frontend team can eyeball
    that page instead of asking you what the response shape is.
"""
from datetime import datetime
from typing import Optional
 
from fastapi import APIRouter, Depends, HTTPException, Query
 
from backend.schemas.market import (
    Interval,
    OHLCVResponse,
    Period,
    TickerSearchResponse,
)
from backend.services.market_data import (
    EmptyDataError,
    MarketDataError,
    MarketDataService,
    get_market_data_service,
)
 
router = APIRouter(prefix="/api/market", tags=["market"])
 

# --------------------------------------------------------------------------- #
# Ticker search
# --------------------------------------------------------------------------- #
@router.get("/search", response_model=TickerSearchResponse)
def search_tickers(
    q: str = Query("", description="Search query (symbol or company name). Empty returns popular list."),
    limit: int = Query(10, ge=1, le=50),
    service: MarketDataService = Depends(get_market_data_service),
) -> TickerSearchResponse:
    """
    Returns ranked matches. Empty query => curated 'popular tickers' list,
    which is what you want for the initial render of the Live Feed page.
    """
    results = service.search_tickers(q, limit=limit)
    return TickerSearchResponse(query=q, results=results)

 
# --------------------------------------------------------------------------- #
# OHLCV retrieval
# --------------------------------------------------------------------------- #
@router.get("/ohlcv", response_model=OHLCVResponse)
def get_ohlcv(
    symbol: str = Query(..., min_length=1, max_length=20, description="Ticker symbol, e.g. 'NVDA'"),
    interval: Interval = Query("1d", description="Bar interval"),
    period: Optional[Period] = Query(
        None,
        description="Convenience window, e.g. '1mo', '1y'. Mutually exclusive with start/end.",
    ),
    start: Optional[datetime] = Query(None, description="Start timestamp (UTC). Pair with `end`."),
    end: Optional[datetime] = Query(None, description="End timestamp (UTC). Pair with `start`."),
    service: MarketDataService = Depends(get_market_data_service),
) -> OHLCVResponse:
    """
    Fetch OHLCV bars for a ticker.
 
    Must specify EITHER:
      - `period` (e.g. '1mo', '1y'), OR
      - both `start` and `end`
 
    If neither is given, defaults to period='1mo'.
    """
    # Validate mutual exclusion / defaulting.
    if period is not None and (start is not None or end is not None):
        raise HTTPException(
            status_code=400,
            detail="Specify either `period` OR `start`+`end`, not both.",
        )
    if period is None and (start is None) != (end is None):
        raise HTTPException(
            status_code=400,
            detail="When using an explicit window, both `start` and `end` are required.",
        )
    if period is None and start is None and end is None:
        period = "1mo"  # sensible default
 
    try:
        response = service.get_ohlcv(
            symbol=symbol,
            interval=interval,
            period=period,
            start=start,
            end=end,
        )
    except EmptyDataError as e:
        # Valid provider response, but zero bars — probably a bad symbol
        # or a window with no trading activity.
        raise HTTPException(
            status_code=404,
            detail=(
                f"No bars returned for symbol={symbol!r} interval={interval!r}. "
                f"Check the symbol and window. ({e})"
            ),
        )
    except MarketDataError as e:
        # All providers failed. This is an upstream/infrastructure issue,
        # not a client error — surface as 502.
        raise HTTPException(
            status_code=502,
            detail=f"Market data providers all failed: {e}",
        )
    except Exception as e:
        # Belt-and-suspenders: anything unexpected becomes a clean 502 too.
        raise HTTPException(
            status_code=502,
            detail=f"Unexpected market data error: {type(e).__name__}: {e}",
        )
 
    return response

