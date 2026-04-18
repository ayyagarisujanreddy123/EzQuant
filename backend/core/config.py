"""
Centralized config. Uses pydantic-settings so env vars are typed and validated.
 
Why this matters for a hackathon: you'll add the Gemini API key, the Supabase keys,
a Polygon key (if you upgrade market data), etc. Having one place where config lives
means you don't sprinkle os.getenv() calls across 10 files.
"""
from functools import lru_cache
from typing import List
 
from pydantic_settings import BaseSettings, SettingsConfigDict
 
 
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # don't crash on unknown env vars
    )
 
    # --- Server ---
    app_env: str = "dev"
    log_level: str = "INFO"
 
    # --- CORS ---
    # Stored as a comma-separated string in env, exposed as a list.
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
 
    # --- Market data caching ---
    market_cache_ttl_intraday: int = 60       # seconds
    market_cache_ttl_daily: int = 60 * 60 * 24  # 24h
 
    # --- Market data providers ---
    # yfinance is the primary provider. It occasionally fails transiently — this
    # controls how many times we retry the underlying call before giving up.
    yfinance_max_retries: int = 2
    yfinance_retry_backoff_seconds: float = 1.5
 
    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
 
 
@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor. Import this, don't instantiate Settings directly."""
    return Settings()
