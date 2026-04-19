# EzQuant — Claude guidance

Visual quant pipeline builder. Frontend = Next.js canvas + Inspector. Backend = FastAPI pipeline executor + pure-function blocks. Auth + persistence via Supabase.

## Stack

- Next.js 16 App Router · TypeScript strict · React 19 · Tailwind v4 (CSS-first)
- `@xyflow/react` v12 · Zustand · Supabase (`@supabase/ssr`)
- FastAPI · pandas · yfinance · scipy
- Testing: pytest (backend only)

## Layout

```
app/              auth/ (login/signup/callback/logout), projects/, canvas/[id]/, gallery/
components/       layout/AppShell, canvas/(Canvas|BlockPalette|Inspector|BottomDrawer|BlockNode),
                  copilot/(CopilotPanel + subs), landing/Landing
hooks/useCopilot  stores/canvasStore  types/index.ts  middleware.ts
lib/              supabase/, api/(pipeline|backend|placeholders), blocks/catalog, mocks/
backend/          main, auth, api/(health|market|pipeline), schemas/, services/(market_data|pipeline_runner|supabase_client),
                  blocks/(source|transforms|features|signal|position|backtest|contract)
supabase/migrations/   SQL run manually in Dashboard
docs/IMPLEMENTATION.md detailed data flow + wiring notes
```

## Block registry (shared contract)

Frontend `lib/blocks/catalog.ts` names MUST match backend `backend/blocks/BLOCK_REGISTRY` keys.

**MVP (10, executable):** `universe`, `csv_upload`, `log_returns`, `forward_return`, `ema`, `momentum`, `signal`, `signal_diagnostics`, `position_sizer`, `backtest`

**Stretch (7, ghosted):** `drop_na`, `resample`, `z_score`, `ems`, `rolling_corr`, `linear_reg`, `equity_curve`

Block functions: `f(inputs: dict, params: dict) -> {df, metrics?, metadata?}`. Never mutate inputs. Never drop columns. Raise `ValueError` on bad input.

## Running

```bash
# Backend :8000
source .venv/bin/activate && uvicorn backend.main:app --reload --port 8000

# Frontend :3000
npm run dev
```

## Testing

```bash
python -m pytest backend/ -v     # 3 IC sanity + 1 E2E pipeline
npx tsc --noEmit                  # frontend types
```

## Env (.env.local at repo root — both frontend and backend read it)

```
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_BACKEND_URL
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
```

## Rules

- **No `tailwind.config.ts`** — Tailwind v4 CSS-first. Add tokens in `app/globals.css @theme`.
- **No inline styles** — extend theme or write a `@utility`.
- **Lookahead guard is sacred** in `backtest`: `position.shift(1) * return`. Do not remove.
- **Single source of truth for blocks** — if you rename/add, update catalog + BLOCK_REGISTRY + mocks + add a SQL migration if existing `projects.graph` references it.
- **RLS enforces auth**, not app code. Frontend calls Supabase with anon key; RLS gates per-user rows.
- **No new state managers** — canvasStore for shared canvas state, `useState` elsewhere.
- **Auto-heal is OK** — block defaults (ema `column='Close'`, backtest derives `log_return` from Close) keep hackathon flows smooth.
- **Mock first, wire later** — `lib/api/placeholders.ts` is the swap layer.
- **Don't commit** `.env.local`, `.claude/settings.local.json`.

## Current focus

Canvas + pipeline executor + agentic-RAG copilot (Gemini 2.0 Flash, real SSE stream, pipeline staging). See `docs/IMPLEMENTATION.md` for wiring details.

## Commands / Agents

- `/deploy` — `.claude/commands/deploy.md`
- `/security-review` — `.claude/agents/security-reviewer.md`
