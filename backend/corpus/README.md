# Quant knowledge corpus

Drop PDFs under `backend/corpus/pdfs/`. They get chunked (paragraph-aware,
~500 words per chunk, 75-word overlap), embedded with Gemini
`text-embedding-004` (`task_type=RETRIEVAL_DOCUMENT`), and stored in
Supabase `knowledge_chunks`.

## One-time DB setup

Run these in order in Supabase → SQL editor:

1. `supabase/migrations/20260418_...` (earlier migrations — projects,
   ohlcv_cache, etc.)
2. `supabase/migrations/20260419_1000_add_match_doc_chunks_rpc.sql`
3. `supabase/migrations/20260419_1001_copilot_messages_columns.sql`

## Env

Backend needs these in `.env.local` (repo root):

```
GOOGLE_API_KEY=...              # https://aistudio.google.com/app/apikey
SUPABASE_URL=...                # or rely on NEXT_PUBLIC_SUPABASE_URL alias
SUPABASE_SERVICE_ROLE_KEY=...
```

## Ingest

```bash
source .venv/bin/activate
python scripts/ingest_corpus.py --path backend/corpus/pdfs
# Re-ingest everything (bypasses the already-ingested guard):
python scripts/ingest_corpus.py --path backend/corpus/pdfs --force
```

Idempotent by filename — rerunning without `--force` skips PDFs already
ingested. Failures on a single file don't abort the run; a summary prints
at the end.

## Smoke test retrieval

```bash
python scripts/test_retrieval.py             # top-5 per query
python scripts/test_retrieval.py --k 3       # top-3
python scripts/test_retrieval.py --threshold 0.6
```

Runs 10 canonical quant queries (IC, Sharpe, momentum, Kelly, factor
models, etc.) and prints the top chunks so you can eyeball relevance.
If the similarity scores look weak, check:

- That `task_type=RETRIEVAL_DOCUMENT` was used at ingest time (and
  `RETRIEVAL_QUERY` at query time — different task types are
  non-negotiable for Gemini embeddings)
- That the PDFs you've dropped actually cover the query topic
- The `match_threshold` (default 0.5)

## What gets stored

Each chunk row in `knowledge_chunks`:

| column | value |
|---|---|
| `source` | PDF filename |
| `source_type` | `quant_reference` by default |
| `content` | chunk text (~500 words) |
| `embedding` | 768-dim vector (Gemini `text-embedding-004`) |
| `metadata` | `{source_filename, page_number, chunk_index, word_count, source_type}` |

## Retrieval from the agent

The copilot calls `search_knowledge(query, source_type?, recency_days?)` which
invokes the `match_doc_chunks` RPC with cosine similarity ranking. Top-k
chunks flow back into the Gemini prompt as citations.
