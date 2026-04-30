# SignalTracer powered by Bloom / EzQuant — Coding Agent Session

A walkthrough of the Claude Code session that took SignalTracer from a hackathon whiteboard sketch to a deployed, demo-ready product that won **Best Use of Gemini** at the Major League Hackathon at UT Austin.

---

## 1. Project Overview

**SignalTracer powered by Bloom** (internal codename: **EzQuant**) is a visual AI pipeline builder for quantitative research and backtested trading signals. Instead of writing throwaway notebooks, a researcher drags blocks onto a canvas — a universe of tickers, transforms, features, a signal block, a position sizer, a backtest — and the pipeline executes server-side and renders the results inline. A Gemini-powered copilot reasons over the canvas, proposes nodes, explains diagnostics, and stages edits the user can accept.

The project was conceived, built, and shipped during a single hackathon weekend. This document describes the coding-agent session that made shipping it on time possible.

---

## 2. Repository, Live Deployment, and Devpost

- **Live App:** https://ez-quant.vercel.app
- **Devpost:** https://devpost.com/software/signaltracer-powered-by-bloom
- **GitHub:** https://github.com/ayyagarisujanreddy123/EzQuant

---

## 3. Coding Agent Used

**Claude Code (Anthropic)** running with the following plugins and skills active across the session:

**Plugins**
- `superpowers` — TDD, systematic debugging, parallel agents, plan execution, verification-before-completion
- `ui-ux-pro-max` — design intelligence (styles, palettes, font pairings, component decisions)
- `claude-mem` — persistent cross-session memory and knowledge base
- `caveman` — terse review/commit messages on demand

**Skills invoked during the session**
- `superpowers:brainstorming` — scoping the hackathon idea into an MVP
- `superpowers:writing-plans` — turning the MVP into a phased plan
- `superpowers:dispatching-parallel-agents` — fanning out independent work (frontend canvas vs. backend executor)
- `superpowers:test-driven-development` — red-green-refactor on the backtest block and IC sanity checks
- `superpowers:systematic-debugging` — 4-phase root cause process for the CORS and SSE issues
- `superpowers:verification-before-completion` — gating "done" claims on real command output
- `superpowers:finishing-a-development-branch` — PR/merge flow at end of work
- `ui-ux-pro-max:ui-ux-pro-max` — Inspector panel, BlockPalette, and Copilot drawer styling
- `design-system` — token pass over `app/globals.css @theme` for Tailwind v4
- `mem-search` / `claude-mem:mem-search` — recalling prior decisions across sessions
- `parallel-agents` — node executor + canvas wiring run concurrently
- `deploy` — Vercel deploy pipeline
- `gsd-plan-phase`, `gsd-execute-phase`, `gsd-verify-work` — phase-based workflow management

---

## 4. Goal of the Coding Session

Ship a deployable, demo-able visual quant pipeline builder with a working Gemini copilot in under 36 hours. Specifically:

1. A canvas where users compose pipelines from typed blocks.
2. A backend that actually executes those pipelines and returns DataFrames + metrics.
3. A Gemini copilot that reads canvas state, streams reasoning over SSE, and stages pipeline edits.
4. Auth + persistence so a judge could log in, save a pipeline, and reload it.
5. A live Vercel URL by demo time.

---

## 5. Problem I Was Trying to Solve

Quant research notebooks are throwaway. Signals get rebuilt from scratch every time, lookahead bias creeps in silently, and there's no shared mental model between a researcher and an LLM assistant about what the pipeline actually *is*. I wanted a structured, visual representation of a signal pipeline that an LLM could reason over deterministically — so the AI isn't guessing what code you ran, it's reading the graph you built.

The technical hard parts:

- **Block contract discipline.** Every block had to be a pure function `f(inputs, params) -> {df, metrics?, metadata?}` with no mutation and no dropped columns, or the copilot's reasoning would diverge from execution.
- **Lookahead guard in `backtest`.** `position.shift(1) * return`, non-negotiable.
- **Frontend/backend registry parity.** `lib/blocks/catalog.ts` names had to match `backend/blocks/BLOCK_REGISTRY` keys exactly.
- **Streaming copilot.** Real SSE, not fake polling — Gemini 2.0 Flash, agentic-RAG, pipeline staging the user can accept/reject.
- **Auth + RLS.** Supabase with anon key on the frontend, RLS gating per-user rows. App code does not enforce auth.

---

## 6. Original Prompts (Excerpts)

A few representative prompts from the session, lightly trimmed:

> "I have ~36 hours. I want a visual pipeline builder for quant signals where a researcher drags blocks onto a canvas, the backend executes the pipeline, and a Gemini copilot can read the canvas and propose edits. Help me scope an MVP — what's the smallest set of blocks that produces a believable backtest curve and an IC chart on stage?"

> "Use `/brainstorming` first. Don't write code yet. I want to lock the block registry before anything else."

> "Lock these 10 blocks as MVP: universe, csv_upload, log_returns, forward_return, ema, momentum, signal, signal_diagnostics, position_sizer, backtest. Stretch (ghosted in palette only): drop_na, resample, z_score, ems, rolling_corr, linear_reg, equity_curve."

> "Frontend `lib/blocks/catalog.ts` keys MUST equal backend `BLOCK_REGISTRY` keys. If you rename, update both plus mocks plus a SQL migration if `projects.graph` references it. This is a hard rule."

> "The Inspector evaluate button needs to call `/api/pipeline/run` with the current node and upstream subgraph, not the whole canvas. Confirm the trigger mechanism before wiring."

> "Stream Gemini through SSE. No fake `setInterval` chunks. The copilot has to *stage* a pipeline diff, not auto-apply. The user clicks Accept."

> "Stop. Use `/systematic-debugging`. The CORS preflight is returning 400 even though I set `allow_origins`. Walk me through the 4-phase root cause."

> "Run `/verification-before-completion` before you tell me anything is done. I've been burned twice this weekend by 'should work'."

> "We're at T-2 hours. `/deploy` to Vercel. If `NEXT_PUBLIC_BACKEND_URL` resolves at build time we're cooked — fix it to resolve at runtime."

---

## 7. Agent's Plan / Investigation Steps

After `/brainstorming` and `/writing-plans`, the agent produced a phased plan roughly equivalent to:

1. **Lock block contract.** Define `f(inputs, params) -> {df, metrics?, metadata?}`. Write the registry. Stub all 10 MVP blocks with `NotImplementedError` and 17 catalog entries (10 active, 7 ghosted).
2. **TDD the math-heavy blocks first.** `log_returns`, `forward_return`, `momentum`, `signal_diagnostics` (IC sanity), `backtest` (lookahead-guarded).
3. **Pipeline runner.** Topological sort over the graph, execute blocks in order, accumulate a context dict, return per-node outputs.
4. **Frontend canvas.** `@xyflow/react` v12, Zustand store (`canvasStore`), `BlockPalette` + `Canvas` + `Inspector` + `BottomDrawer` + custom `BlockNode`.
5. **Inspector "Evaluate" trigger.** Confirmed as button click (not auto-on-edit) — sends node + upstream subgraph to `/api/pipeline/run`.
6. **Supabase auth + persistence.** `@supabase/ssr` browser + server clients, middleware-based session refresh, RLS migration, `projects` table holding the graph as JSONB.
7. **Gemini copilot.** Gemini 2.0 Flash, agentic-RAG over the block registry + current canvas, real SSE stream, staged pipeline diffs the user accepts in the `CopilotPanel`.
8. **Deploy.** Vercel for frontend, backend on Railway, runtime resolution of `NEXT_PUBLIC_BACKEND_URL`.
9. **Demo polish.** Landing page, Inspector CSV export, signout button, golden-path smoke test.

The agent kept this plan visible across the session and only deviated when verification flagged drift.

---

## 8. Files / Components Inspected or Modified

**Frontend**
- `app/globals.css` — Tailwind v4 `@theme` tokens; fixed a real bug where font vars lived under the wrong layer and color tokens never compiled into the CSS bundle. Moved font vars to `@theme inline`, color tokens then appeared in the compiled bundle.
- `app/canvas/[id]/page.tsx` — `handleSave` wired to Supabase `update(projects)`.
- `app/projects/page.tsx` — "+ New Pipeline" button → Supabase `insert(projects)`; template cards.
- `app/auth/(login|signup|callback|logout)/` — auth pages and route handlers.
- `components/canvas/(Canvas|BlockPalette|Inspector|BottomDrawer|BlockNode).tsx`
- `components/copilot/CopilotPanel.tsx` + sub-components — SSE stream, staged-diff UI.
- `components/layout/AppShell.tsx` — added signout button + user email display in nav.
- `hooks/useCopilot.ts` — SSE event source, message buffer, staged-graph state.
- `stores/canvasStore.ts` — Zustand canvas state, single source of truth.
- `lib/supabase/(client|server).ts` — `@supabase/ssr` clients.
- `lib/blocks/catalog.ts` — 17 entries, 10 active + 7 ghosted.
- `lib/api/(pipeline|backend|placeholders).ts` — placeholders mock layer; pipeline + backend swap-in.
- `middleware.ts` — Supabase session refresh + protected routes.
- `types/index.ts` — shared block + node types.

**Backend**
- `backend/main.py` — FastAPI app, CORS config (the source of the preflight 400 — see debugging below).
- `backend/api/(health|market|pipeline).py`
- `backend/services/(market_data|pipeline_runner|supabase_client).py`
- `backend/blocks/(source|transforms|features|signal|position|backtest|contract).py` — all 10 MVP blocks.
- `backend/auth.py` — Supabase JWT verification.
- `backend/schemas/` — Pydantic request/response shapes.

**Infra / config**
- `supabase/migrations/` — `projects`, `ohlcv` cache, RLS policies, storage bucket.
- `.env.example`, `.env.local`
- `requirements.txt`
- `vercel.json` (runtime backend URL fix)

---

## 9. Features Built

- **Canvas + Inspector + BlockPalette + BottomDrawer** with drag-from-palette node creation and edge typing.
- **10 executable MVP blocks** + **7 ghosted stretch blocks** in the palette.
- **Pipeline runner** with topological execution and per-node output caching.
- **Inspector "Evaluate"** button — runs the focused node + upstream subgraph and shows DataFrame head, metrics, and a chart.
- **CSV export** from the data toolbar.
- **Supabase auth** (email/password) with login, signup, callback, logout, and middleware-based protected routes.
- **Project persistence** — `projects` table with JSONB graph; "+ New Pipeline" + Save button wired end-to-end.
- **Gemini copilot** with agentic-RAG, real SSE streaming, and staged pipeline diffs.
- **Landing page** + signout button in nav.

---

## 10. AI / Gemini Integration Details

- **Model:** Gemini 2.0 Flash (chosen over Pro for streaming latency on stage).
- **Pattern:** Agentic-RAG. The copilot receives:
  1. The block registry (names, params, input/output shapes).
  2. A serialized snapshot of the current canvas graph from `canvasStore`.
  3. Optional pipeline run results pulled from the latest `/api/pipeline/run` response.
- **Streaming:** Real Server-Sent Events. `useCopilot` opens an `EventSource` to a Next.js route that proxies Gemini's streaming response. Tokens flow into the `CopilotPanel` as they arrive — no fake chunking.
- **Pipeline staging:** When the model proposes graph edits, they are emitted as a structured diff (add nodes, add edges, set params). The diff is *staged* — rendered as a translucent overlay on the canvas with an Accept / Reject control. The user must explicitly accept before `canvasStore` mutates. This was a deliberate design call: judges asked about hallucination risk and we wanted a visible human-in-the-loop step.
- **Grounding:** The copilot never invents block names. The system prompt enumerates the registry and instructs the model to refuse if a requested transform doesn't have a corresponding block — it then suggests the closest match.

---

## 11. Frontend / Backend Changes (highlights)

**Frontend**
- Replaced mock project data in `lib/api/placeholders.ts` with real Supabase queries behind the same interface so the swap was a one-import change.
- Added the staged-diff overlay layer to `Canvas.tsx` — a second `ReactFlow` instance rendered with reduced opacity and `nodesDraggable={false}`.
- Fixed the Tailwind v4 token compilation issue in `app/globals.css` (font vars under `@theme inline`).
- Wired the AppShell signout button to `supabase.auth.signOut()` + redirect.

**Backend**
- Implemented all 10 MVP block functions following the `f(inputs, params) -> {df, metrics?, metadata?}` contract.
- `pipeline_runner.py`: topological sort, per-node memoization, structured error responses including the failing node id.
- `auth.py`: Supabase JWT verification using `SUPABASE_JWT_SECRET` so backend endpoints can scope reads/writes to the calling user.
- `market_data.py`: yfinance-backed OHLCV fetcher with a Supabase `ohlcv` cache table to avoid rate limiting during the demo.

---

## 12. Debugging Steps

Three real problems hit during the session. Each one was worked through with `/systematic-debugging`.

**A. Tailwind v4 color tokens not compiling.**
Symptom: classes like `bg-bg-primary` produced no styles in production CSS. Investigation: dumped the compiled bundle and grepped for the token names — fonts were present, colors absent. Root cause: font CSS variables had been declared in a way that closed the `@theme` block early, so subsequent color tokens were parsed as plain CSS and dropped. Fix: moved font vars to `@theme inline`. Verified by re-grepping the compiled bundle and confirming all color tokens + utilities were emitted.

**B. CORS preflight returning 400 on the copilot route.**
Symptom: browser shows `OPTIONS /api/copilot 400` even though FastAPI `CORSMiddleware` was configured with the right origin. Investigation: walked the request through middlewares in order. Root cause: a custom auth dependency was running on `OPTIONS` requests because the route had a global `Depends(verify_jwt)` and no preflight bypass. Fix: short-circuited `OPTIONS` in the auth dependency. Verified with `curl -X OPTIONS` showing `200` and the Access-Control-Allow-* headers.

**C. `NEXT_PUBLIC_BACKEND_URL` baked at build time on Vercel.**
Symptom: production frontend talked to localhost. Root cause: `NEXT_PUBLIC_*` is inlined at build. Fix: resolved the backend URL at runtime via a small `lib/api/backend.ts` helper that reads from a Vercel runtime config + window origin fallback, so the same build artifact works in preview and production.

Port 3000 also held onto a zombie process during local dev — `kill -9` was required because SIGTERM was insufficient. Logged that for future-me.

---

## 13. Commands Run

```bash
git clone https://github.com/ayyagarisujanreddy123/EzQuant.git
cd EzQuant
npm install
npm run dev

# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# Tests
python -m pytest backend/ -v
npx tsc --noEmit

# Build
npm run build

# Git
git status
git diff
git add .
git commit -m "Build Gemini-powered signal tracing workflow"
git push origin main

# Supabase migration
# Ran SQL from supabase/migrations/ in the Supabase Dashboard SQL editor

# Free port 3000 when SIGTERM didn't take
lsof -i :3000
kill -9 <pid>
```

---

## 14. Deployment Steps

1. Frontend deployed to **Vercel** from the GitHub repo. Project linked to `main`.
2. Backend deployed separately and exposed via HTTPS; URL provided to the frontend through runtime config (after the build-time-inlining fix).
3. Supabase project provisioned; SQL migrations from `supabase/migrations/` executed in the Dashboard.
4. Environment variables configured in Vercel:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_BACKEND_URL` (read at runtime)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
5. Verified the live URL https://ez-quant.vercel.app: signup → create pipeline → drag blocks → evaluate → copilot chat → save → reload.

---

## 15. Validation / Testing

- **`pytest backend/ -v`** — 3 IC sanity tests on `signal_diagnostics` + 1 end-to-end pipeline test exercising universe → log_returns → momentum → signal → position_sizer → backtest.
- **`npx tsc --noEmit`** — frontend type-check clean before each push.
- **Manual golden path** in a real browser: signup → new pipeline → assemble the demo graph → evaluate each node → run full backtest → ask the copilot to swap momentum lookback from 20 to 60 → accept the staged diff → re-run → save → log out → log back in → reload pipeline → re-run.
- **Lookahead guard verified** — wrote a test that fails if `position.shift(1)` is removed from `backtest`. The guard is sacred.

The agent refused to mark anything done until the corresponding command output was visible in the session — `verification-before-completion` was strictly enforced.

---

## 16. Final Result

A deployed, working visual quant pipeline builder with:

- A canvas users can actually build pipelines on.
- A backend that actually runs them.
- A Gemini copilot that actually streams and actually stages edits.
- Auth + persistence that actually round-trips through Supabase.
- A live URL judges could click.

**Outcome:** Won **Best Use of Gemini** at the Major League Hackathon at UT Austin.

---

## 17. Why I'm Proud of This Session

I didn't use the coding agent as a code generator. I used it as a collaborator across the entire arc of the project:

- **Scoping.** `/brainstorming` forced me to lock the block registry on day zero. Every later decision flowed from that contract.
- **Planning.** `/writing-plans` turned a vague hackathon idea into a phased plan I could actually execute against under time pressure.
- **Parallelization.** `/dispatching-parallel-agents` let independent work — backend block implementations vs. frontend canvas wiring — proceed concurrently without stepping on each other.
- **Discipline.** `/test-driven-development` on the math-heavy blocks meant the lookahead guard and IC sanity checks were locked before I touched the UI.
- **Debugging.** `/systematic-debugging` saved me from the CORS preflight rabbit hole and the Tailwind v4 token compilation bug — both would have eaten hours.
- **Honesty.** `/verification-before-completion` stopped the agent from telling me things "should work." Every "done" had a command output behind it.
- **Memory.** `claude-mem` carried context across breaks — when I came back to the laptop, the agent already knew where we were.
- **Design taste.** `ui-ux-pro-max` and the `design-system` skill gave the app a coherent visual language under hackathon time pressure, not a Bootstrap-default look.
- **Shipping.** `/deploy` and `/finishing-a-development-branch` got it onto Vercel and into git history cleanly before demo time.

I went from a sketch on a whiteboard to a deployed product with a streaming Gemini copilot and a winning hackathon submission, without breaking the block contract, without removing the lookahead guard, and without faking any "done" claims along the way. The agent didn't replace the engineering — it gave the engineering a structure that survived 36 hours of pressure.

That's the part I'm proud of.
