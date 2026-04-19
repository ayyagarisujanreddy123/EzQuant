# EzQuant

Visual quant pipeline builder. Drag blocks onto a canvas, wire them together, fetch market data, backtest. AI copilot (Gemini) suggests templates + explains results.

**Current focus: the Canvas.** All non-trivial product work happens in `/canvas/[id]` — palette, block nodes, inspector, run animation, copilot integration.

## Stack (as-built)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2 App Router | Turbopack dev, server components where useful |
| Language | TypeScript 5 (strict) | |
| UI lib | React 19 | |
| Styling | Tailwind CSS v4 | CSS-first `@theme` block in `app/globals.css` — NO `tailwind.config.ts` |
| Graph / canvas | `@xyflow/react` (React Flow v12) | Every block renders through one component: `BlockNode` |
| Icons | `lucide-react` | |
| Client state | Zustand (`stores/canvasStore.ts`) for canvas; `useState` elsewhere | |
| Auth + DB | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | RLS enforces per-user isolation |
| Fonts | `next/font` — DM Sans + JetBrains Mono | Wired into Tailwind via `@theme inline` |
| Backend | FastAPI + yfinance (`backend/`) | Market data + OHLCV; runs on `:8000` |
| Testing | None yet | |

## Directory Layout

```
app/
  globals.css               # Tailwind v4 @theme + custom utilities
  layout.tsx                # Fonts + root
  page.tsx                  # redirects /  → /projects
  auth/
    login/page.tsx          # email+password + magic link
    signup/page.tsx
    callback/route.ts       # OAuth / magic-link exchange
    logout/route.ts         # POST/GET sign-out
  projects/page.tsx         # list + New Pipeline + Templates
  canvas/
    page.tsx                # index → /canvas/proj-4 fallback
    [id]/page.tsx           # CANVAS: palette | reactflow | inspector | copilot
  gallery/page.tsx          # template gallery
components/
  layout/AppShell.tsx       # nav + ⌘K dispatcher + sign-out button
  canvas/
    Canvas.tsx              # ReactFlow wrapper, drag-drop, copilot banner
    BlockPalette.tsx        # categorised drag/click sources from BLOCK_CATALOG
    Inspector.tsx           # Data / Params / Eval tabs — Evaluate button, CSV download
    BottomDrawer.tsx        # resizable Registry + Console
    nodes/BlockNode.tsx     # single node component (all 14 block types)
  copilot/
    CopilotPanel.tsx        # header, context strip, modes, thread, composer, slash commands
    MessageBubble.tsx
    ToolPill.tsx CitationChip.tsx AttachmentChip.tsx
    AppliedBanner.tsx ThinkingIndicator.tsx
hooks/useCopilot.ts         # async generator consumer → message thread
stores/canvasStore.ts       # nodes, edges, selected, statuses, patchNodeData
lib/
  supabase/{client,server}.ts   # SSR clients
  api/
    backend.ts              # fetchOhlcv() → FastAPI
    placeholders.ts         # fetchProjects, fetchProject, createProject, saveProject → Supabase;
                            #  streamCopilotChat, runPipeline still mocked
  blocks/catalog.ts         # 14 BlockDefinitions — single source of truth for palette + node types
  mocks/                    # mockCanvasState, mockProjects, mockTemplates, mockMessages
middleware.ts               # session refresh + route guard
types/index.ts              # all shared types — NodeData, Project, CopilotEvent, etc.
backend/                    # Robert's FastAPI — main.py, api/market.py, services/market_data.py
docs/
  IMPLEMENTATION.md         # component tree, state map, TODO locations
  superpowers/plans/2026-04-18-ezquant-frontend.md   # original 22-task build plan
docs:ui-reference.html      # visual mockup — source of truth for layout/colors
```

## Design Tokens (Tailwind v4)

Defined in `app/globals.css` `@theme` block. Key palette:

- `bg-bg-0` .. `bg-bg-4` — dark background scale (#0b0d12 → #242a3c)
- `text-eq-t1 / t2 / t3` — text primary/secondary/tertiary
- `bg-eq-green / red / amber / blue` + `-dim` variants — semantic status
- `bg-eq-accent` (#8b7dff) — copilot / selection purple
- `bg-eq-cyan` (#22d3ee) — gemini / generated-by-copilot glow
- `bg-gemini` + `text-gemini` — accent→cyan gradient utilities (custom `@utility`)
- `animate-t1 / t2 / t3` — thinking-pulse staggered (ThinkingIndicator)
- Fonts via `--font-sans` / `--font-mono` → `font-sans` / `font-mono`

**DO NOT** write inline styles — extend via `@theme` in `globals.css`.

## Data Flow

### Canvas → Zustand → ReactFlow
```
BlockPalette.onClick/Drag → Canvas.onDrop → canvasStore.addNodes([node])
ReactFlow emits onNodesChange → canvasStore.onNodesChange (applyNodeChanges)
Inspector reads selectedNodeId → renders tabs → updateParam / patchNodeData
```

### Backend OHLCV (Ticker Source only, today)
```
Inspector.Evaluate button (ticker_source)
  → lib/api/backend.ts fetchOhlcv({symbol, interval, start, end})
  → GET http://localhost:8000/api/market/ohlcv
  → patchNodeData(id, { bars, quality }) + setStatuses({id:'success'})
  → auto-switch Inspector to Data tab → "↓ CSV" download available
```

### Supabase (projects + auth)
```
Projects page → fetchProjects() → supabase.from('projects').select()
+ New Pipeline / Template click → createProject() → router.push(/canvas/:id)
Canvas Save button → saveProject({ id, name, graph })
middleware.ts → gates every request; redirects to /auth/login if unauthed
```

### Copilot (still mocked)
```
CopilotPanel.send → useCopilot → streamCopilotChat (async generator)
  tool_use / tool_result / text / citations / applied_banner / suggest_pipeline_template
  → setMessages + onPipelineGenerated callback
```

## Environment

- `.env.local` (gitignored) holds all keys. Template in `.env.example`.
- Active today: `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Reserved for later: `GOOGLE_API_KEY`, `POLYGON_API_KEY`, `PIPELINE_RUNNER_URL`, S3 bucket vars

## Supabase Schema

Managed via SQL in Supabase Dashboard. Tables:

| Table | Role |
|---|---|
| `profiles` | 1:1 with `auth.users` — display name, avatar |
| `projects` | pipeline graphs (jsonb) + summary (sharpe, block_count) |
| `pipeline_runs` | backtest history (not wired yet) |
| `copilot_messages` | chat persistence (not wired yet) |
| `attachments` | metadata + pointer to Storage bucket `attachments/` |
| `knowledge_chunks` | RAG embeddings, vector(768) (not wired yet) |
| `ohlcv_cache` | optional Yahoo response cache (not wired yet) |

All use RLS `auth.uid() = user_id`. `knowledge_chunks` is read-any-authed, write-service-role.

## Running

```bash
# Frontend (http://localhost:3000)
npm run dev

# Backend (http://localhost:8000)
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

Visit http://localhost:3000 → middleware redirects to `/auth/login` if unauthenticated.

## Canvas Focus Areas (priorities going forward)

1. **Wire Run button end-to-end** — currently mock stagger animation. Hook `runPipeline` to backend, stream real node statuses via `pipeline_runs` row.
2. **Extend Evaluate beyond ticker_source** — each transform block (`log_returns`, `ema`, `momentum`, ...) should execute against upstream data. Needs a graph-walking runner in backend.
3. **Edge validation** — prevent cycles + type mismatches (Data → Clean → Signal → Model → Eval).
4. **Live node parameter preview in BlockNode** — currently shows only first param. Show more where useful.
5. **Canvas zoom/pan controls + minimap** (ReactFlow `<MiniMap />`, `<Controls />`).
6. **Multi-select + bulk operations** (delete, group).
7. **Connection handles** — enforce one input per target port, multiple outputs ok.
8. **Undo/redo** on canvasStore actions.
9. **Canvas persistence** — auto-save graph every N seconds instead of only via Save button.

## Workflow (for future work)

1. Brief the work against the Canvas focus list above
2. `/writing-plans` → plan multi-step features
3. `/dispatching-parallel-agents` → split if independent (rare — canvas state is shared)
4. `/verification-before-completion` → `tsc --noEmit` + hit the actual URL in browser
5. `/finishing-a-development-branch` → PR to `develop`

## Rules of Thumb

- **No `tailwind.config.ts`** — v4 is CSS-first. Add tokens in `app/globals.css @theme`.
- **No inline styles** — extend theme or write a `@utility`.
- **No new state managers** — canvasStore for shared canvas state, useState elsewhere. Don't reach for Redux/Jotai.
- **Mock first, wire later** — `lib/api/placeholders.ts` is the layer to swap.
- **RLS, not app code, enforces auth** — Supabase queries via `lib/supabase/client` are safe to call from browser because RLS gates rows.
- **Single source of truth for blocks** — add a new block type by editing `lib/blocks/catalog.ts` + registering in `NODE_TYPES` in `Canvas.tsx`.
- **Mobile-first still applies** — the 4-col canvas layout breaks below 1024px; that's a known gap, not a design choice.

## Known Issues / Gaps

- Pipeline Run is still animation-only (no backend call)
- Copilot responses still mocked (no Gemini call)
- No auto-save — user must click Save
- `/canvas` (no id) redirects to a hardcoded `proj-4` which may not exist in Supabase → 404. Fix: redirect to first real project or /projects.
- ESLint v9 + `FlatCompat` breaks — `npx eslint` errors with circular-JSON. Non-blocking; tsc passes.
- Canvas page layout assumes desktop width (no mobile adaptation).

## Commands

- `/deploy` → `.claude/commands/deploy.md`
- `/security-review` → `.claude/agents/security-reviewer.md`
