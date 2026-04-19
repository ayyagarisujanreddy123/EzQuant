# EzQuant Frontend ↔ Backend — Implementation Reference

## Component Tree

```
AppShell (nav + ⌘K dispatcher + sign-out)
├── /                    → Landing (public) · signed-in → /projects
├── /auth/*              → login / signup / callback / logout
├── /projects            → fetchProjects (Supabase), + New Pipeline, Templates
├── /canvas/[id]
│   ├── TopBar           → Run (real) / Save / Projects
│   ├── BlockPalette     → click / drag from BLOCK_CATALOG
│   ├── Canvas           → ReactFlow + BlockNode (all 17 types registered)
│   ├── Inspector        → Data · Params (Evaluate) · Eval (Backtest / Diagnostics)
│   └── BottomDrawer     → Registry + Console (resizable)
└── /gallery             → template grid
Copilot FAB (fixed bottom-right) · toggled by nav badge or ⌘K
```

## Data Flow

### Canvas editing (pure client)
```
BlockPalette.onClick / drag → Canvas.onDrop
  → canvasStore.addNodes([newNode])
ReactFlow onNodesChange → canvasStore.onNodesChange
Inspector Params input → canvasStore.updateParam(id, key, value)
```

### Backend pipeline run
```
Frontend: runPipeline(graph, { runTo?, persist })
  → attaches `Authorization: Bearer <supabase_jwt>`
  → POST http://localhost:8000/api/pipeline/run
Backend:
  auth.verify_jwt → user_id
  execute_pipeline:
    Kahn topo sort (cycle detection)
    run_to → restrict to ancestors + target
    for each node:
      inputs = {} (sources) | { df } (transforms) | { signal_df, forward_return_df } (diag)
      out = BLOCK_REGISTRY[blockType](inputs, params)
      dfs[id] = out.df
    assemble NodeResult per node (df_preview, quality, metrics, diagnostics)
  if persist and no run_to → insert row in pipeline_runs (graph_snapshot + node_results)
  return RunResponse
Frontend: canvasStore.applyRunResults(res.node_results) + setStatuses
```

### OHLCV cache (persistent, adaptive TTL)
```
Service.get_ohlcv(symbol, ...):
  1. in-memory TTLCache (hot path)
  2. supabase ohlcv_cache  WHERE cache_key=? AND expires_at>now
  3. yfinance (with curl_cffi + retries)
  4. upsert ohlcv_cache with adaptive TTL:
       end_date within 7d → 1h
       end_date older    → 30d
```

## Block Registry — Frontend ↔ Backend Contract

| Block | Frontend params | Backend impl |
|---|---|---|
| `universe` | name, symbol, start, end, interval | yfinance.download |
| `csv_upload` | file_path, date_column | pd.read_csv |
| `log_returns` | column | `log(p_t / p_{t-1})` |
| `forward_return` | column, horizon | `log(p_{t+h} / p_t)` |
| `ema` | column, span | `ewm(span).mean()` |
| `momentum` | column, lookback, mode | price-diff or rolling-sum |
| `signal` | column, name | copies column → `df.signal` |
| `signal_diagnostics` | ic_type, forward_return_column | IC + tstat + decay + stability + autocorr |
| `position_sizer` | mode, upper_threshold, lower_threshold | `+1/0/-1` by thresholds |
| `backtest` | return_column, cost_bps | `position.shift(1) * return` + metrics |

Stretch (frontend ghosted, backend refuses at run): `drop_na`, `resample`, `z_score`, `ems`, `rolling_corr`, `linear_reg`, `equity_curve`.

## State Ownership

| State | Owner |
|---|---|
| `nodes, edges, selectedNodeId` | `canvasStore` (Zustand) |
| `runId, lastRunResults, isRunning` | `canvasStore` |
| `messages, mode, attachments` | `useCopilot` hook, per-panel |
| `projects, creating` | Local useState, ProjectsPage |
| `projectName, saveState, runError` | Local useState, CanvasPage |
| `tab, draft` | Local useState, Inspector / CopilotPanel |

## Key Files

| File | Role |
|---|---|
| `backend/blocks/*.py` | 10 pure-function blocks (see `BLOCK_REGISTRY`) |
| `backend/services/pipeline_runner.py` | Kahn topo sort + executor + preview assembly |
| `backend/services/market_data.py` | yfinance provider + 2-layer cache |
| `backend/services/supabase_client.py` | Service-role client singleton |
| `backend/api/pipeline.py` | `POST /api/pipeline/run` + `GET /api/pipeline/runs/{id}` |
| `backend/auth.py` | `verify_jwt` dependency (PyJWT, HS256) |
| `backend/schemas/pipeline.py` | Pydantic: Pipeline, Node, Edge, RunRequest, RunResponse, NodeResult |
| `lib/api/pipeline.ts` | Frontend `runPipeline` + `fetchRun` with Bearer token |
| `lib/api/placeholders.ts` | Supabase projects CRUD; re-exports runPipeline |
| `lib/blocks/catalog.ts` | Single source of truth — matches backend registry |
| `stores/canvasStore.ts` | `applyRunResults` stashes statuses/metrics/diagnostics onto nodes |
| `components/canvas/Inspector.tsx` | Data / Params / Eval tabs; Evaluate unified via `runPipeline(runTo=id)` |

## Auth Flow

1. Browser: `supabase.auth.signInWithPassword` → session cookie + JWT
2. Every `/api/pipeline/*` request: `Authorization: Bearer <access_token>`
3. Backend `verify_jwt` decodes with `SUPABASE_JWT_SECRET`, returns `sub` (user_id)
4. `pipeline_runs` row written under that `user_id`; RLS enforces ownership on reads

## Supabase Schema

| Table | Purpose | Policies |
|---|---|---|
| `profiles` | 1:1 `auth.users`, display info | self-only |
| `projects` | pipeline graphs (jsonb) + summary | self-only |
| `pipeline_runs` | run history (project_id nullable) | self-only |
| `copilot_messages` | chat per project (future) | self-only |
| `attachments` | file metadata → Storage | self-only |
| `knowledge_chunks` | RAG embeddings (future) | read-auth, write-service_role |
| `ohlcv_cache` | yfinance cache (adaptive TTL) | read-auth, write-service_role |

Run the SQL in `supabase/migrations/` in filename order (they're timestamp-prefixed).

## Environment Variables

**Frontend `.env.local`**:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Backend `.env` (loaded from repo root)**:
```
SUPABASE_URL=<same as NEXT_PUBLIC_SUPABASE_URL>
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...   # Dashboard → API → JWT Settings
```

## Known Limitations (MVP)

- **Single-branch `signal_diagnostics`** — signal_df and forward_return_df are sourced from the same upstream DataFrame. Multi-branch wiring is Phase 2.
- **No intermediate memoization** — Evaluate re-fetches yfinance on every click (mitigated by `ohlcv_cache`).
- **Polling endpoint not in use** — `/runs/{id}` exists, but `execute_pipeline` runs synchronously inside the request for now. Polling wakes up when we move to background workers.
- **Stretch blocks** — `drop_na`, `resample`, `z_score`, `ems`, `rolling_corr`, `linear_reg`, `equity_curve`. BlockPalette renders them ghosted; backend refuses to execute with a clear error.
- **No cycle UI** — backend rejects cycles with a clear pipeline error; no visual loop detection during edge wiring.

## How to Run

```bash
# Backend (port 8000)
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Frontend (port 3000)
npm run dev
```

## How to Test

```bash
# Block sanity tests (IC math)
python -m pytest backend/blocks/tests/ -v

# End-to-end NVDA pipeline (hits yfinance live)
python -m pytest backend/test_full_pipeline.py -v

# Frontend types
npx tsc --noEmit
```

---

## Agent / Copilot data flow (Loops 1 + 2)

### Frontend → Backend
```
User types in CopilotPanel composer
  → useCopilot.send()
  → serializeCanvas(nodes, edges, lastRunResults)  // ≤7500 chars
  → streamCopilotChat() (lib/api/copilot.ts)
  → POST /api/agent/chat  { message, page_context, session_id, canvas_state, mode }
      Authorization: Bearer <supabase access_token>
```

`session_id`: stable per `(user, projectId)` via `localStorage:ezq_chat_session:<projectId>`. Null project = `global` bucket.

### Backend orchestrator loop
```
verify_jwt → user_id
run_agent:
  1. persist user turn to copilot_messages
  2. build system_prompt(page_context, mode, canvas_state)
  3. start chat with Gemini 2.0 Flash
     - tools = [search_knowledge, suggest_pipeline_template]
     - enable_automatic_function_calling=False
     - safety = BLOCK_ONLY_HIGH (all four categories)
  4. loop (max 5 tool turns):
     a. send_message
     b. for each text part → yield {type:'text', content}
     c. for each function_call → yield tool_use (running) → execute tool
        → yield tool_use (done) → append function_response
     d. if no function_calls: break
  5. emit {type:'citations', sources} (de-duplicated by source+page)
  6. persist assistant turn to copilot_messages
  7. yield {type:'done'}
```

### SSE event types shipped
- `text` — streamed content
- `tool_use` with `status: running|done`
- `citations` with `sources: Citation[]`
- `pipeline_template` with `template: {name, description, rationale, graph}`
- `done`

### Tools
- **`search_knowledge(query, source_type?, recency_days?)`** → embeds query with `RETRIEVAL_QUERY`, calls `match_doc_chunks` RPC, returns top-8 chunks. Used for grounded Q&A.
- **`suggest_pipeline_template(goal, ticker?, constraints?)`** → retrieves similar templates (if corpus has any with `source_type='pipeline_template'`), asks Gemini for a JSON graph via `response_mime_type='application/json'`, validates against the MVP block catalog, up to 2 retries on validator errors.

### Canvas staging (Loop 2)
```
pipeline_template event
  → useCopilot handler
  → canvasStore.stagePipelineTemplate(template)
    - nodes cloned with data.pending=true, data.source='copilot'
    - edges cloned with data.pending=true
    - pendingTemplate stored
Canvas.tsx:
  - unions real + pending into renderedNodes/Edges
  - pending edges get dashed cyan stroke
  - pending nodes render ghosted (60% opacity + dashed border) via BlockNode
  - banner at top: "✦ Copilot suggested N blocks · [Apply] [Reject]"

Apply → canvasStore.applyStaged():
  - merges pending into nodes/edges (dedupe by id)
  - strips pending=true flags
  - clears pending* state
Reject → canvasStore.rejectStaged():
  - clears pending* state only
```

### RAG ingestion
```
scripts/ingest_corpus.py --path backend/corpus/pdfs
  → pdfplumber.extract_text per page
  → chunk_text (paragraph-aware, 500-word target, 75-word overlap)
  → embed_document (Gemini text-embedding-004, task_type=RETRIEVAL_DOCUMENT, batch size 100)
  → insert into knowledge_chunks with metadata
    { source_filename, page_number, chunk_index, word_count, source_type }
```

Idempotent by filename. Use `--force` to reingest.

### Supabase objects added
- `knowledge_chunks.metadata jsonb` + GIN index
- `knowledge_chunks_source_idx`, `knowledge_chunks_created_idx`
- `match_doc_chunks(query_embedding, match_threshold, match_count, filter_source_type?, filter_ticker?, filter_recency_days?)` SECURITY DEFINER function, granted to `authenticated`
- `copilot_messages.session_id`, `attachments`, `created_at` columns
- Role check loosened to include `assistant`

### Env additions (`.env.local`)
```
GOOGLE_API_KEY=<Gemini key>
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
```

### Files added
```
backend/agent/__init__.py
backend/agent/embeddings.py
backend/agent/ingestion.py
backend/agent/retrieval.py
backend/agent/prompts.py
backend/agent/tools.py
backend/agent/orchestrator.py
backend/api/agent.py
scripts/ingest_corpus.py
scripts/test_retrieval.py
supabase/migrations/20260419_1000_add_match_doc_chunks_rpc.sql
supabase/migrations/20260419_1001_copilot_messages_columns.sql
backend/corpus/README.md
lib/api/copilot.ts
lib/canvas/serialize.ts
```

### Files touched (additive only)
- `backend/main.py` — register `agent` router
- `backend/core/config.py` — `google_api_key`, `gemini_model`, `gemini_embedding_model`
- `backend/requirements.txt` — `google-generativeai`, `pdfplumber`
- `types/index.ts` — `PipelineTemplate`, `pipeline_template` CopilotEvent, `NodeData.pending`
- `stores/canvasStore.ts` — `pendingNodes`, `pendingEdges`, `stagePipelineTemplate`, `applyStaged`, `rejectStaged`
- `components/canvas/nodes/BlockNode.tsx` — dashed cyan border + 60% opacity when `data.pending`
- `components/canvas/Canvas.tsx` — unions pending with real, renders banner + dashed edges
- `lib/api/placeholders.ts` — re-exports `streamCopilotChat` from `lib/api/copilot.ts`
- `hooks/useCopilot.ts` — `session_id` management, `canvas_state` serialization, `pipeline_template` handler
