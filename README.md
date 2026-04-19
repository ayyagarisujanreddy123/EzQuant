# SignalTracer

> **Visual quant research — trace every signal from data to backtest.**
>
> A production-grade, full-stack platform for designing, running, and diagnosing systematic trading strategies on a drag-and-drop canvas, with an agentic RAG copilot (Bloom) that can wire pipelines for you from a sentence.

---

## Table of contents

1. [Overview](#overview)
2. [Tech stack](#tech-stack)
3. [Architecture](#architecture)
4. [Repository layout](#repository-layout)
5. [Key features](#key-features)
6. [Block catalog](#block-catalog)
7. [The Bloom copilot (agentic RAG)](#the-bloom-copilot-agentic-rag)
8. [Pipeline executor](#pipeline-executor)
9. [Data model (Supabase)](#data-model-supabase)
10. [Auth flow](#auth-flow)
11. [Market data layer](#market-data-layer)
12. [Environment variables](#environment-variables)
13. [Running locally](#running-locally)
14. [Testing](#testing)
15. [Project conventions](#project-conventions)
16. [Roadmap](#roadmap)

---

## Overview

SignalTracer lets a researcher compose an end-to-end quant pipeline as a DAG of typed blocks:

```
Universe → Log Returns → EMA-20 → Signal → Forward Return → Signal Diagnostics
                                         ↘ Position Sizer → Backtest
```

Every block is a pure Python function enforcing a uniform contract
(`f(inputs: dict, params: dict) -> {df, metrics?, metadata?}`). The canvas is
the authoritative view of the pipeline; the backend executes it with a
topologically-sorted runner that forks per-ticker for multi-asset universes,
enforces lookahead-safety inside `backtest`, and aggregates cross-sectional
diagnostics.

Complementing the builder is **Bloom**, an agentic RAG copilot powered by
Gemini 2.5 Flash. Bloom can:

- Answer grounded quant-theory questions with inline citations from a
  pgvector knowledge base (147+ PDFs ingested).
- Stage a full executable pipeline from a natural-language goal (e.g.
  *"backtest cross-sectional momentum on NVDA, AAPL, SPY"*) as ghosted
  nodes the user can Apply or Reject.
- Diagnose failed runs by reading the serialized canvas state (node ids,
  params, last-run errors).

---

## Tech stack

### Frontend

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16.2 (App Router)** | SSR auth, fast navigations, streaming SSE |
| Language | **TypeScript strict**, React 19 | Type-safe UI, shared types with backend schemas |
| Canvas | **@xyflow/react v12** | Production React Flow with custom node renderers |
| State | **Zustand 5** | Single canvas store, no Redux boilerplate |
| Styling | **Tailwind v4 (CSS-first)** | `@theme` tokens in `globals.css`, no `tailwind.config.ts` |
| Icons | **lucide-react** | Tree-shakeable icon set |
| Markdown | **react-markdown + remark-gfm** | Agent replies with tables, code blocks, citations |
| Supabase | **@supabase/ssr** | SSR-safe auth + session refresh |

### Backend

| Layer | Choice | Why |
|---|---|---|
| Server | **FastAPI 0.115** + uvicorn | Async, typed, auto OpenAPI docs |
| Validation | **pydantic 2 / pydantic-settings** | Request/response schemas, `.env.local` loading |
| Compute | **pandas 2.2, numpy, scipy, statsmodels** | The quant research standard |
| Market data | **yfinance + curl_cffi** | Bulk OHLCV, TLS impersonation to evade anti-bot |
| Auth | **PyJWT + JWKS** | HS256 *and* ES256/RS256/EdDSA Supabase tokens |
| DB client | **supabase-py (service role)** | Persist runs, chat, RAG chunks |
| Agent | **google-generativeai** | Gemini 2.5 Flash (chat + tool use + multimodal) |
| Ingestion | **pdfplumber** | Per-page text extraction → chunking → pgvector |
| HTTP | **httpx** | Async HTTP for JWKS + external APIs |
| Caching | **cachetools (TTLCache)** | In-memory L1 for market data |
| Tests | **pytest** | 3 IC sanity checks + 1 end-to-end pipeline test |

### Infrastructure

- **Supabase** — Postgres + RLS + auth + **pgvector** (768-dim embeddings)
- **Gemini 2.5 Flash** — Chat model (function calling, session memory)
- **Gemini 2.5 Flash Image** — Chart generation tool
- **gemini-embedding-001** — Task-typed retrieval embeddings (`RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY`)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js 16)                         │
│                                                                     │
│   ┌──────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │
│   │  Landing /   │  │  AppShell   │  │  Bloom FAB (floating)   │    │
│   │  Projects /  │─▶│  Canvas +   │◀─┤  CopilotPanel (SSE)     │    │
│   │  Gallery     │  │  Inspector  │  │  Animated avatar        │    │
│   └──────────────┘  └─────────────┘  └─────────────────────────┘    │
│           │                │                    │                    │
│           │                │                    │ Bearer JWT          │
│           ▼                ▼                    ▼                    │
└───────────┼────────────────┼────────────────────┼───────────────────┘
            │                │                    │
            │                │                    │
┌───────────┼────────────────┼────────────────────┼───────────────────┐
│           │                │                    │                    │
│           ▼                ▼                    ▼                    │
│   ┌──────────────┐  ┌─────────────┐    ┌──────────────────┐          │
│   │  Supabase    │  │  FastAPI    │    │  FastAPI         │          │
│   │  (auth +     │  │  /api/      │    │  /api/agent/chat │          │
│   │   projects + │  │  pipeline/  │    │  (SSE stream)    │          │
│   │   RLS)       │  │  run        │    │                  │          │
│   └──────────────┘  └─────────────┘    └──────────────────┘          │
│           │                │                    │                    │
│           │                ▼                    ▼                    │
│           │        ┌─────────────┐    ┌─────────────────────┐         │
│           │        │  Pipeline   │    │  Orchestrator       │         │
│           │        │  Runner     │    │  (Gemini 2.5 Flash) │         │
│           │        │  (Kahn,     │    │  ├ search_knowledge │         │
│           │        │  per-ticker │    │  ├ suggest_template │         │
│           │        │  forking)   │    │  └ generate_chart   │         │
│           │        └──────┬──────┘    └──────────┬──────────┘         │
│           │               │                      │                    │
│           │               ▼                      ▼                    │
│           │        ┌─────────────┐    ┌─────────────────────┐         │
│           │        │  10 MVP     │    │  pgvector           │         │
│           │        │  blocks     │    │  (knowledge_chunks) │         │
│           │        │  (pure fns) │    └─────────────────────┘         │
│           │        └──────┬──────┘                                    │
│           │               ▼                                           │
│           │        ┌─────────────┐                                    │
│           └───────▶│  Supabase   │◀── service role (bypasses RLS)    │
│                    │  pipeline_  │                                    │
│                    │  runs,      │                                    │
│                    │  ohlcv_     │                                    │
│                    │  cache,     │                                    │
│                    │  copilot_   │                                    │
│                    │  messages   │                                    │
│                    └─────────────┘                                    │
└───────────────────────────────────────────────────────────────────────┘
```

### Request flow — running a pipeline

1. User hits **Run** on `/canvas/[id]` → `runPipeline()` in `lib/api/pipeline.ts`.
2. Frontend POSTs `{ graph, projectId, persist: true }` to `/api/pipeline/run` with Bearer JWT.
3. Backend verifies JWT (`backend/auth.py`), parses `Pipeline`, topologically sorts via Kahn's algorithm.
4. Source blocks run once; if `metadata.per_ticker` present, downstream blocks fork per ticker.
5. Cross-sectional blocks (`signal_diagnostics`) collapse back to a single panel-input execution.
6. On success, `pipeline_runs` row written via service-role client; response includes `node_results`, `statuses`, `run_id`.
7. `applyRunResults()` in `stores/canvasStore.ts` ingests results → Inspector re-renders.

### Request flow — chatting with Bloom

1. User types in CopilotPanel → `send()` in `hooks/useCopilot.ts`.
2. Canvas serialized via `serializeCanvas()` (≤7500 chars).
3. POST to `/api/agent/chat` (SSE) with `message`, `page_context`, `canvas_state`, `session_id`, `mode`.
4. `orchestrator.run_agent()` loads prior turns from `copilot_messages` (≤20, ≤2000 chars each).
5. Manual function-calling loop (max 5 tool cycles): `search_knowledge` → `suggest_pipeline_template` → `generate_chart`.
6. SSE events stream back: `text`, `tool_use`, `tool_result`, `citations`, `pipeline_template`, `image`, `done`.
7. On `pipeline_template`, `stagePipelineTemplate()` ghosts nodes on the canvas; user clicks **Apply** or **Reject**.

---

## Repository layout

```
SignalTracer/
├── app/                          Next.js App Router pages
│   ├── page.tsx                  Landing (unauth) / redirect to /projects (auth)
│   ├── layout.tsx                Root layout + fonts + metadata
│   ├── globals.css               Tailwind v4 @theme tokens
│   ├── projects/page.tsx         Project list + quick-start grid
│   ├── canvas/[id]/page.tsx      Main canvas editor
│   ├── gallery/page.tsx          Template gallery w/ search + SVG previews
│   └── auth/                     login/, signup/, callback/, logout/
│
├── components/
│   ├── layout/AppShell.tsx       Nav + user menu + logout
│   ├── canvas/
│   │   ├── Canvas.tsx            ReactFlow wrapper + drag-drop + pending overlays
│   │   ├── BlockPalette.tsx      Category-grouped sidebar, stretch blocks ghosted
│   │   ├── Inspector.tsx         Data / Params / Eval tabs + Evaluate + CSV export
│   │   ├── BottomDrawer.tsx      Registry descriptors (e.g. NVDA_OHLCV_LR_EMA20)
│   │   └── nodes/BlockNode.tsx   Custom ReactFlow node (status, badges, ports)
│   ├── copilot/
│   │   ├── CopilotPanel.tsx      Floating panel + FAB + first-encounter greeting
│   │   ├── BloomAvatar.tsx       Animated SVG face (blink, glance, tie, smile cycle)
│   │   ├── MessageBubble.tsx     Markdown + GFM + tool calls + citations + images
│   │   ├── ThinkingIndicator.tsx Streaming dots
│   │   ├── AttachmentChip.tsx    File attachments
│   │   ├── CitationChip.tsx      Inline [n] links
│   │   └── AppliedBanner.tsx     Toast after template applied
│   └── landing/Landing.tsx       Marketing page
│
├── backend/
│   ├── main.py                   FastAPI entrypoint (CORS, routes, logging)
│   ├── auth.py                   Dual-mode JWT verify (HS256 + JWKS)
│   ├── core/config.py            pydantic-settings (.env.local)
│   ├── api/
│   │   ├── agent.py              POST /api/agent/chat (SSE)
│   │   ├── pipeline.py           POST /api/pipeline/run
│   │   ├── market.py             GET /api/market/ohlcv, /search
│   │   └── health.py             GET /health
│   ├── agent/
│   │   ├── prompts.py            COMMON_RULES + ASK/SUGGEST/DEBUG modes
│   │   ├── tools.py              search_knowledge, suggest_pipeline_template, generate_chart
│   │   ├── orchestrator.py       Function-calling loop + session history
│   │   ├── embeddings.py         gemini-embedding-001 (768-dim)
│   │   ├── ingestion.py          PDF → chunks → pgvector
│   │   └── retrieval.py          match_doc_chunks RPC caller
│   ├── blocks/
│   │   ├── __init__.py           BLOCK_REGISTRY (shared contract)
│   │   ├── contract.py           BlockOutput TypedDict
│   │   ├── source.py             universe, csv_upload
│   │   ├── transforms.py         log_returns, forward_return
│   │   ├── features.py           ema, momentum
│   │   ├── signal.py             signal, signal_diagnostics (CS-IC)
│   │   ├── position.py           position_sizer
│   │   ├── backtest.py           Lookahead-guarded PnL + Sharpe
│   │   └── tests/                pytest fixtures + sanity tests
│   ├── services/
│   │   ├── pipeline_runner.py    Kahn sort + per-ticker forking
│   │   ├── market_data.py        yfinance + TTL cache + Supabase L2
│   │   └── supabase_client.py    Service-role client singleton
│   └── schemas/
│       ├── pipeline.py           Pipeline, Node, Edge, NodeResult, RunRequest/Response
│       └── market.py             OHLCVBar, OHLCVResponse, Interval
│
├── lib/
│   ├── supabase/client.ts        Browser client
│   ├── supabase/server.ts        Server/SSR client
│   ├── api/
│   │   ├── placeholders.ts       Project CRUD (Supabase) + streamCopilotChat export
│   │   ├── pipeline.ts           runPipeline() → backend
│   │   ├── backend.ts            fetchOhlcv()
│   │   └── copilot.ts            SSE consumer for /api/agent/chat
│   ├── blocks/catalog.ts         17 block definitions (10 MVP + 7 stretch)
│   ├── canvas/serialize.ts       Compact JSON of canvas for agent context
│   └── mocks/                    MOCK_TEMPLATES, MOCK_*_GRAPH
│
├── hooks/useCopilot.ts           Messages, streaming, session_id per project
├── stores/canvasStore.ts         Zustand: nodes, edges, pending*, lastRunResults
├── types/index.ts                Shared TS types
├── middleware.ts                 Auth gate (public: /, /auth/*, /_next)
│
├── supabase/migrations/          SQL run in Supabase dashboard
│   ├── 20260418_1900_extend_pipeline_runs.sql
│   ├── 20260418_1901_rebuild_ohlcv_cache.sql
│   ├── 20260418_1902_rename_block_types.sql
│   ├── 20260419_1000_add_match_doc_chunks_rpc.sql
│   └── 20260419_1001_copilot_messages_columns.sql
│
├── scripts/
│   ├── ingest_corpus.py          Batch PDF → pgvector
│   └── test_retrieval.py         Smoke-test vector search
│
├── docs/
│   └── IMPLEMENTATION.md         Deep-dive data-flow + wiring notes
│
├── .env.example                  Full env var map
├── CLAUDE.md                     Agent guidance for this repo
├── next.config.ts / tsconfig.json / eslint.config.mjs / postcss.config.mjs
└── package.json
```

---

## Key features

### Canvas & execution

- **Drag-drop block placement** on a ReactFlow canvas with snap-to-grid and live edges.
- **17-block catalog** (10 executable MVP + 7 ghosted stretch) shared verbatim between frontend and backend.
- **Multi-ticker Universe** — CSV list (`"NVDA, AAPL, SPY"`) forks downstream execution per ticker; Inspector gets a ticker dropdown.
- **Run** (full pipeline, persists to `pipeline_runs`) and **Evaluate** (run up to selected node, no persist).
- **Lookahead guard** baked into `backtest`: `position.shift(1) * return` — non-removable.
- **Cycle detection** up-front; stretch blocks hard-rejected at runtime.
- **Error isolation** — one failed node marks its descendants `skipped`; independent branches continue.
- **CSV export** of the last run's `df_preview`.
- **Keyboard shortcuts** — `⌘K` focuses Bloom; `⌘↵` runs.

### Inspector

- **Data tab** — `df_preview` table (capped at 3000 rows server-side), shape, date range, NaN count, missing %.
- **Params tab** — type-aware editors (select, number, string, boolean) + live column-name dropdowns derived from upstream outputs.
- **Eval tab** — Sharpe, max drawdown, hit rate, equity sparkline, diagnostics cards.
- **Ticker dropdown** appears when per-ticker results present; hides on the Eval tab for `signal_diagnostics` (cross-sectional IC is single-view).
- **Resizable left edge** (200-700 px).

### Signal diagnostics (cross-sectional IC)

- Rank-correlates each timestamp's cross-section of signal values against forward returns (Spearman by default).
- **Headline metrics**: mean IC, t-stat (`mean_IC · √T / σ_IC`), rank autocorrelation (period-over-period signal stability), n_tickers, sample size.
- **IC decay** at horizons 1, 5, 10.
- **Monthly stability** series.
- **Warnings** for <5 assets, high NaN ratios, suspiciously-high |IC| (lookahead sentinel).
- Works with 2+ assets; logs a warning below 5. Single-ticker pipelines raise an explicit error pointing to the config issue.

### Gallery & templates

- Three seeded templates (AAPL Momentum, NVDA Momentum, SPY + IC Diagnostics).
- **Search** by name / ticker / description.
- **Filter chips** — `all` / `momentum` / `diagnostics`.
- **SVG mini-graph previews** derived from the actual template graph with category-colored nodes and bezier edges.
- **Sharpe pill** color-graded: ≥1 green, ≥0.4 amber, <0.4 red.
- **"Generate with Bloom"** card dispatches a `focus-composer` event to invite a natural-language prompt.
- Clicking a template creates a real Supabase project (via `createProject`) and routes to `/canvas/[id]` — no fake IDs.

### Bloom (agentic RAG copilot)

- **Floating FAB** bottom-right on every authenticated page with an animated avatar (blink, pupil glance, cyan tie, cycling smile expressions, float drift, pulse halo while streaming).
- **First-encounter greeting popup** — speech bubble with tail pointing at the FAB, persists dismissal in localStorage.
- **Ask / Suggest / Debug modes** wire different system prompts.
- **Session-persistent chat** — `session_id` in localStorage, history replayed from `copilot_messages` on reload.
- **Per-page context** — different sidebar context line depending on `/projects`, `/canvas/[id]`, `/gallery`.
- **Multimodal** — attach images (base64-encoded into the request) or PDFs; agent can return inline images too.
- **Pipeline staging** — suggested graphs appear as dashed cyan nodes with `Apply` / `Reject` controls.

### Auth & persistence

- Supabase email/password (signup, login, callback, logout handlers).
- Middleware gate on all non-public routes.
- Row-level security on `projects`, `pipeline_runs`, `copilot_messages`.
- Backend dual-mode JWT verify (legacy HS256 via `SUPABASE_JWT_SECRET`, modern ES256/RS256/EdDSA via JWKS endpoint).

### Market data

- **yfinance** with `curl_cffi` Chrome TLS impersonation, 2-retry exponential backoff.
- **Two-layer cache**: `TTLCache` (in-memory L1) → Supabase `ohlcv_cache` (persistent L2).
- **Adaptive TTL** — intraday 60 s, daily 24 h, historical (>7 days) 30 d.
- **Ticker search** via hardcoded popular list + optional Polygon.io key.

---

## Block catalog

The canvas has one source of truth: `lib/blocks/catalog.ts` (frontend) mirrors `backend/blocks/BLOCK_REGISTRY` (backend). Names must match exactly.

### MVP (10 — executable)

| Type | Category | Purpose | Key params |
|---|---|---|---|
| `universe` | data | yfinance OHLCV, supports CSV multi-ticker list | `symbol`, `start`, `end`, `interval` |
| `csv_upload` | data | Fallback data loader | `file_path`, `date_column` |
| `log_returns` | clean | `log(p_t / p_{t-1})` | `column` |
| `forward_return` | clean | Prediction target `log(p_{t+h} / p_t)` | `column`, `horizon` |
| `ema` | signal | Exponential moving average feature | `column`, `span` |
| `momentum` | signal | Price- or return-based momentum | `column`, `lookback`, `mode` |
| `signal` | signal | Pins a column as `df.signal` | `column`, `name` |
| `signal_diagnostics` | signal | Cross-sectional IC, decay, stability, t-stat | `ic_type`, `forward_return_column` |
| `position_sizer` | model | Threshold signal into {-1, 0, +1} | `mode`, `upper_threshold`, `lower_threshold` |
| `backtest` | eval | Lookahead-guarded PnL + Sharpe + DD + hit rate | `return_column`, `cost_bps` |

### Stretch (7 — ghosted; backend rejects at runtime)

`drop_na`, `resample`, `z_score`, `ems`, `rolling_corr`, `linear_reg`, `equity_curve`

### Block contract

```python
def block_fn(inputs: dict[str, pd.DataFrame], params: dict) -> dict:
    # inputs keyed by port name; never mutate
    df = inputs["df"].copy()
    df["ema_20"] = df["Close"].ewm(span=params["span"]).mean()
    return {
        "df": df,
        "metrics": {...},     # optional
        "metadata": {...},    # optional — e.g. per_ticker payloads
    }
```

Rules: **never mutate inputs; never drop existing columns; raise `ValueError` on bad input.**

---

## The Bloom copilot (agentic RAG)

### System prompts — `backend/agent/prompts.py`

- **COMMON_RULES** — identity ("Bloom — SignalTracer's senior quant research agent"), turn-taking (never speak first; short intro only on greeting), tone, grounding, output format, block vocabulary, routing rules (pipeline vs drawing), glossary.
- **Three modes**:
  - `ask` — calls `search_knowledge` first, cites sources inline `[1]`, `[2]`.
  - `suggest` — calls `suggest_pipeline_template`, enforces signal-first topology, requires a `signal` ancestor before `signal_diagnostics`.
  - `debug` — works schema → params → data availability → lookahead, one change at a time.

### Tools — `backend/agent/tools.py`

| Tool | Purpose |
|---|---|
| `search_knowledge(query, source_type?, recency_days?)` | Embed query (task=`RETRIEVAL_QUERY`) → `match_doc_chunks` RPC → top-k ranked chunks |
| `suggest_pipeline_template(goal, ticker?, constraints?)` | Generates a validated graph (nodes+edges), enforces signal-first topology, retries with error feedback if validation fails |
| `generate_chart(description, chart_type?)` | Delegates to Gemini 2.5 Flash Image model; returns inline PNG |

### Orchestrator — `backend/agent/orchestrator.py`

- Manual function-calling loop, `MAX_TOOL_TURNS = 5`.
- `BLOCK_ONLY_HIGH` safety settings across all harm categories.
- `_load_session_history()` replays last 20 turns (≤2000 chars each) filtered by `session_id + user_id`.
- Multimodal first turn: combines text + image `inline_data` into a single `Content` with multiple `Part`s.
- Emits `{type: 'image'}` SSE events for inline response images and for `generate_chart` tool results.
- `_persist_message()` writes each turn to `copilot_messages` for cross-session continuity.

### RAG pipeline — `backend/agent/ingestion.py`

```
PDF (pdfplumber) → paragraph-aware chunking (~500 words, 75 overlap)
    → gemini-embedding-001 (task=RETRIEVAL_DOCUMENT, 768-dim)
    → knowledge_chunks (pgvector, with source/page/metadata)
```

Use:

```bash
python scripts/ingest_corpus.py --path backend/corpus/pdfs --source-type quant_reference
python scripts/test_retrieval.py "what is a reasonable IC?"
```

### Frontend wiring

- `hooks/useCopilot.ts` — message state, `session_id` per `(user, project)` via localStorage.
- `lib/api/copilot.ts` — SSE consumer, Bearer token from Supabase, base64-encodes image attachments chunked via `bytesToBase64()` (≤4 MB).
- `lib/canvas/serialize.ts` — compact JSON of nodes/edges/lastRun for canvas context (≤7500 chars).
- `stores/canvasStore.ts` — `stagePipelineTemplate()`, `applyStaged()`, `rejectStaged()` for the approval flow.

---

## Pipeline executor

`backend/services/pipeline_runner.py`

1. **Kahn's algorithm** for topological order; cycles rejected with a clear message.
2. **`run_to`** mode (Evaluate button): prune graph to target's ancestors.
3. **Source blocks** (`universe`, `csv_upload`) run once. Multi-ticker universes set `metadata.per_ticker = {ticker: df}`; runner seeds `dfs_by_ticker`.
4. **Downstream blocks** loop over tickers, each executes in its own ticker namespace.
5. **Cross-sectional blocks** (`CROSS_SECTIONAL_BLOCKS = {"signal_diagnostics"}`) collapse the panel and run once with the full `{ticker: df}` dict as input.
6. **Error isolation** — a failed node marks strict descendants `skipped`; unrelated branches continue.
7. **Persistence** — on success, writes `pipeline_runs` (graph_snapshot, node_results, run_id) via the service-role client.

Data-quality computation (`_compute_data_quality`) decorates each result: row count, date range, NaN count, lookahead-risk flag (duplicate/backwards dates).

---

## Data model (Supabase)

Migrations live in `supabase/migrations/` and are applied manually via the Supabase SQL editor.

| Table | Columns (abridged) | Notes |
|---|---|---|
| `projects` | `id uuid`, `user_id uuid`, `name text`, `graph jsonb`, `saved_at timestamptz` | RLS: `user_id = auth.uid()` |
| `pipeline_runs` | `id uuid`, `user_id uuid`, `project_id uuid?`, `graph_snapshot jsonb`, `node_results jsonb`, `run_to_node text?`, `started_at`, `finished_at` | RLS: `own_runs` |
| `copilot_messages` | `id uuid`, `user_id`, `project_id?`, `session_id text`, `role text`, `content text`, `attachments jsonb`, `created_at` | RLS: `own_msgs` |
| `knowledge_chunks` | `id bigserial`, `source text`, `content text`, `embedding vector(768)`, `metadata jsonb`, `created_at` | Written by service role only; readable by authenticated users |
| `ohlcv_cache` | `symbol text`, `date date`, OHLCV cols, `cached_at timestamptz` | Composite PK `(symbol, date, interval)` |

RPC: `match_doc_chunks(query_embedding vector, match_threshold float, match_count int, filter_source text?)` — cosine-distance kNN used by `retrieve_context()`.

---

## Auth flow

### Frontend

- `middleware.ts` — public paths: `/`, `/auth/*`, `/_next/*`, `/favicon*`. All other paths require a Supabase session cookie, else redirect to `/auth/login?next=…`. Already-logged-in users on login/signup bounce to `/projects`.
- `lib/supabase/client.ts` — browser client using anon key.
- `lib/supabase/server.ts` — SSR client; never exposes service role.
- Auth pages under `app/auth/` handle signup/login/callback/logout.

### Backend

- `backend/auth.py` — FastAPI `verify_jwt` dependency.
  - If token alg = HS256, verifies with `SUPABASE_JWT_SECRET`.
  - Else fetches `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` via `PyJWKClient` (cached 1 h) and verifies with the matching public key (ES256/RS256/EdDSA supported).
  - Audience `authenticated`, requires `sub` + `exp`.

---

## Market data layer

- `backend/api/market.py`
  - `GET /api/market/ohlcv?symbol=SPY&interval=1d&start=…&end=…`
  - `GET /api/market/search?query=NVDA&limit=10`
- `backend/services/market_data.py`
  - `YFinanceProvider` — `curl_cffi` Chrome impersonation, 2 retries with 1.5 s backoff; normalizes intraday vs daily.
  - `MarketDataService` — `TTLCache` keyed by `(symbol, interval, start, end)`; adaptive TTLs from `backend/core/config.py`.
- Frontend consumer: `lib/api/backend.ts` → `fetchOhlcv()`, used by Inspector's **Data** tab and the Evaluate flow.

---

## Environment variables

All variables are read from **`.env.local` at the repo root** (both frontend and backend load it). Copy `.env.example` to start:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | FE | App base URL (auth redirects) |
| `NEXT_PUBLIC_BACKEND_URL` | FE | FastAPI base URL (default `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | FE+BE | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | FE | Anon key (RLS-gated) |
| `SUPABASE_SERVICE_ROLE_KEY` | BE | Service role for writes + RAG ingestion (never exposed to browser) |
| `SUPABASE_JWT_SECRET` | BE | Legacy HS256 token secret; optional when JWKS works |
| `GOOGLE_API_KEY` | BE | Gemini API key |
| `GEMINI_MODEL` | BE | Default `gemini-2.5-flash` |
| `GEMINI_IMAGE_MODEL` | BE | Default `gemini-2.5-flash-image` |
| `GEMINI_EMBEDDING_MODEL` | BE | Default `gemini-embedding-001` |
| `POLYGON_API_KEY` | BE | Optional — richer ticker search |
| `CORS_ORIGINS` | BE | Comma-separated allowed origins |
| `LOG_LEVEL` | BE | `info` / `debug` |

---

## Running locally

### Prerequisites

- Node 20+, npm
- Python 3.10+ (3.11 recommended)
- A Supabase project (free tier works). Enable the `vector` extension.

### 1. Clone & install

```bash
git clone https://github.com/ayyagarisujanreddy123/EzQuant.git signaltracer
cd signaltracer/EzQuant

# Frontend
npm install

# Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env.local
# fill in Supabase URL / anon / service-role / JWT secret + GOOGLE_API_KEY
```

### 3. Run Supabase migrations

Open each file under `supabase/migrations/*.sql` in the Supabase SQL editor **in timestamp order** and execute.

### 4. (Optional) Ingest the knowledge base

```bash
mkdir -p backend/corpus/pdfs
# drop PDF papers in backend/corpus/pdfs
python scripts/ingest_corpus.py --path backend/corpus/pdfs
python scripts/test_retrieval.py "what is a reasonable IC?"
```

### 5. Start both servers

```bash
# Terminal 1 — backend :8000
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — frontend :3000
npm run dev
```

- App → <http://localhost:3000>
- API docs → <http://localhost:8000/docs>

---

## Testing

```bash
# Backend — pytest IC sanity + E2E pipeline
python -m pytest backend/ -v

# Frontend — strict type-check
npx tsc --noEmit
```

Sanity tests guarantee:

- IC ≈ 1 when `signal == forward_return`.
- IC ≈ 0 for random-noise signals (|t| < 2).
- IC > 0.95 when a signal leaks future data (lookahead sentinel).
- End-to-end pipeline returns populated `node_results`, valid statuses, and lookahead-guarded backtest metrics.

---

## Project conventions

- **No `tailwind.config.ts`.** Tailwind v4 is CSS-first; all tokens live in `app/globals.css` inside an `@theme` block.
- **No inline styles.** Extend the theme or write a `@utility`.
- **Single source of truth for blocks.** If you add/rename a block, update `lib/blocks/catalog.ts` + `backend/blocks/__init__.py` + any affected `mockCanvasState.ts` entries + add a SQL migration if existing `projects.graph` references it.
- **RLS enforces auth, not app code.** The frontend calls Supabase with the anon key; RLS gates per-user rows.
- **Lookahead guard is sacred** in `backtest`: `position.shift(1) * return` — do not remove.
- **No new state managers.** `canvasStore` for shared canvas state; `useState` everywhere else.
- **Auto-heal defaults** — blocks fall back to sensible defaults (`ema.column='Close'`, `backtest` derives `log_return` from `Close`) to keep hackathon flows smooth.
- **Mock first, wire later** — `lib/api/placeholders.ts` is the swap layer for project CRUD.
- **Never commit** `.env.local` or `.claude/settings.local.json`.

---

## Roadmap

- Replace stretch blocks with real implementations (`drop_na`, `z_score`, `rolling_corr`, `linear_reg`, `equity_curve`).
- Parquet-based feature caching layer keyed by `(graph_hash, data_range)`.
- Walk-forward validation block with rolling re-fits.
- Regime-conditional backtest metrics (bull/bear/chop).
- Shareable read-only project links.
- Gemini function-calling for live data queries (`get_fundamentals`, `get_macro_series`).
- Multi-factor position sizer (Kelly, ERC, min-vol).

---

## License

See `LICENSE` at the repo root.

---

**Built with Gemini 2.5 Flash, Next.js 16, FastAPI, Supabase, and a lot of respect for lookahead bias.**
