-- ─────────────────────────────────────────────────────────────────────────────
-- Rebuild ohlcv_cache with indexable columns (ticker, start, end, interval)
-- plus `data` + `metadata` jsonb, and adaptive-TTL expires_at.
--
-- Adaptive TTL (enforced by the backend, not here):
--   end_date older than 7 days   → 30 days
--   end_date within last 7 days  → 1 hour
--
-- Reads/writes: service_role only (backend caches on behalf of users).
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists public.ohlcv_cache cascade;

create table public.ohlcv_cache (
  cache_key  text primary key,            -- "TICKER:INTERVAL:START:END"
  ticker     text not null,
  interval   text not null,
  start_date date not null,
  end_date   date not null,
  data       jsonb not null,              -- list of OHLCVBar-shaped objects
  metadata   jsonb,                       -- { bar_count, source, cached_from_provider }
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index ohlcv_cache_ticker_idx on public.ohlcv_cache(ticker, end_date desc);
create index ohlcv_cache_expires_idx on public.ohlcv_cache(expires_at);

alter table public.ohlcv_cache enable row level security;

-- Readable by any signed-in user (cache hit speeds up their Evaluate clicks).
create policy "read_cache_authed" on public.ohlcv_cache
  for select using (auth.role() = 'authenticated');

-- Writes: service_role only (bypasses RLS). No insert/update/delete policy for anon.
