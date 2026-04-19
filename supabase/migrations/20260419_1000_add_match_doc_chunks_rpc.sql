-- ─────────────────────────────────────────────────────────────────────────────
-- Vector retrieval RPC for the EzQuant agentic-RAG copilot.
--
-- Adds a `metadata jsonb` column to knowledge_chunks (flexible home for
-- source_filename / page_number / chunk_index / word_count / ticker / etc.)
-- and a `match_doc_chunks` SECURITY DEFINER function the backend calls.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Metadata column (additive — safe to re-run)
alter table public.knowledge_chunks
  add column if not exists metadata jsonb;

create index if not exists knowledge_chunks_meta_gin_idx
  on public.knowledge_chunks using gin (metadata);

create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks(source);

create index if not exists knowledge_chunks_created_idx
  on public.knowledge_chunks(created_at desc);

-- 2. The RPC the retrieval module calls.
--
-- Filters:
--   filter_source_type   — optional; match knowledge_chunks.source_type
--   filter_ticker        — optional; match metadata->>ticker
--   filter_recency_days  — optional; restrict to rows created within N days
--
-- Ranks by cosine similarity (<=> operator, 1 - cosine distance).
create or replace function public.match_doc_chunks(
  query_embedding       vector(768),
  match_threshold       float default 0.5,
  match_count           int   default 8,
  filter_source_type    text  default null,
  filter_ticker         text  default null,
  filter_recency_days   int   default null
)
returns table (
  id          uuid,
  source      text,
  source_type text,
  content     text,
  similarity  float,
  metadata    jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    kc.id,
    kc.source,
    kc.source_type,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity,
    kc.metadata
  from public.knowledge_chunks kc
  where kc.embedding is not null
    and (filter_source_type is null or kc.source_type = filter_source_type)
    and (filter_ticker is null or kc.metadata->>'ticker' = filter_ticker)
    and (filter_recency_days is null
         or kc.created_at >= now() - (filter_recency_days || ' days')::interval)
    and 1 - (kc.embedding <=> query_embedding) >= match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

-- Authenticated users can call this RPC; writes are still service-role only.
grant execute on function public.match_doc_chunks(
  vector(768), float, int, text, text, int
) to authenticated;
