# EzQuant Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build a production Next.js 14 App Router frontend for EzQuant — a quant pipeline builder with a React Flow canvas, AI copilot panel, and three pages (Projects, Canvas, Gallery). Frontend only; backend wired via typed placeholder stubs.

**Architecture:** App Router with three routes (`/projects`, `/canvas/[id]`, `/gallery`). Shared `AppShell` provides nav + ⌘K. Each page owns its layout including a `CopilotPanel` docked right. Canvas page uses a 4-column grid (BlockPalette | ReactFlow | Inspector | Copilot). Zustand (`canvasStore`) owns canvas state shared across Canvas, Inspector, BottomDrawer, and Copilot callback.

**Tech Stack:** Next.js 14, TypeScript strict, Tailwind CSS, @xyflow/react, lucide-react, zustand, next/font (DM Sans + JetBrains Mono)

---

## File Map

```
app/
  globals.css
  layout.tsx
  page.tsx                        → redirect to /projects
  projects/page.tsx
  canvas/[id]/page.tsx
  gallery/page.tsx
components/
  layout/AppShell.tsx
  copilot/
    CopilotPanel.tsx
    ThinkingIndicator.tsx
    ToolPill.tsx
    CitationChip.tsx
    AttachmentChip.tsx
    AppliedBanner.tsx
    MessageBubble.tsx
  canvas/
    Canvas.tsx
    BlockPalette.tsx
    Inspector.tsx
    BottomDrawer.tsx
    nodes/BlockNode.tsx
hooks/useCopilot.ts
stores/canvasStore.ts
lib/
  api/placeholders.ts
  blocks/catalog.ts
  mocks/
    mockProjects.ts
    mockMessages.ts
    mockTemplates.ts
    mockCanvasState.ts
types/index.ts
docs/IMPLEMENTATION.md
tailwind.config.ts
next.config.ts
```

---

### Task 1: Scaffold Next.js 14

**Files:** `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts` (initial), `.eslintrc.json`

- [ ] Run scaffold (answer "No" to Turbopack if prompted):
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --no-turbopack
```
- [ ] Install additional deps:
```bash
npm install @xyflow/react lucide-react zustand
```
- [ ] Verify dev server starts:
```bash
npm run dev &
sleep 5 && curl -s http://localhost:3000 | head -5
```
- [ ] Kill dev server, commit:
```bash
git add package.json package-lock.json next.config.ts tsconfig.json tailwind.config.ts .eslintrc.json
git commit -m "feat: scaffold Next.js 14 with xyflow, lucide, zustand"
```

---

### Task 2: Design Tokens — tailwind.config.ts + globals.css

**Files:** `tailwind.config.ts`, `app/globals.css`

- [ ] Replace `tailwind.config.ts` with:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: { 0:'#0b0d12', 1:'#10131b', 2:'#161a25', 3:'#1c2131', 4:'#242a3c' },
        eq: {
          green: '#2dd4a0',
          'green-dim': 'rgba(45,212,160,0.12)',
          red: '#f87171',
          'red-dim': 'rgba(248,113,113,0.12)',
          amber: '#fbbf24',
          'amber-dim': 'rgba(251,191,36,0.12)',
          blue: '#60a5fa',
          'blue-dim': 'rgba(96,165,250,0.12)',
          accent: '#8b7dff',
          'accent-2': '#6851ff',
          'accent-dim': 'rgba(139,125,255,0.14)',
          cyan: '#22d3ee',
          'cyan-dim': 'rgba(34,211,238,0.12)',
          t1: '#e8eaf0',
          t2: '#8b909e',
          t3: '#555a6a',
          border: 'rgba(255,255,255,0.06)',
          'border-2': 'rgba(255,255,255,0.11)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      backgroundImage: {
        gemini: 'linear-gradient(135deg,#8b7dff 0%,#22d3ee 100%)',
      },
      keyframes: {
        'thinking-pulse': {
          '0%,100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        't1': 'thinking-pulse 1.2s ease-in-out infinite',
        't2': 'thinking-pulse 1.2s ease-in-out 0.2s infinite',
        't3': 'thinking-pulse 1.2s ease-in-out 0.4s infinite',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] Replace `app/globals.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-0:#0b0d12; --bg-1:#10131b; --bg-2:#161a25; --bg-3:#1c2131; --bg-4:#242a3c;
  --border:rgba(255,255,255,0.06); --border-2:rgba(255,255,255,0.11);
  --green:#2dd4a0; --green-dim:rgba(45,212,160,0.12);
  --red:#f87171;   --red-dim:rgba(248,113,113,0.12);
  --amber:#fbbf24; --amber-dim:rgba(251,191,36,0.12);
  --blue:#60a5fa;  --blue-dim:rgba(96,165,250,0.12);
  --t1:#e8eaf0; --t2:#8b909e; --t3:#555a6a;
  --accent:#8b7dff; --accent-2:#6851ff; --accent-dim:rgba(139,125,255,0.14);
  --gemini:linear-gradient(135deg,#8b7dff 0%,#22d3ee 100%);
  --cyan:#22d3ee; --cyan-dim:rgba(34,211,238,0.12);
}

html, body { height: 100%; background: var(--bg-0); color: var(--t1); }

@layer utilities {
  .text-gemini {
    background: var(--gemini);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .border-gemini { border-color: var(--cyan); }
  .glow-cyan { box-shadow: 0 0 0 2px var(--cyan-dim); border-color: var(--cyan); }
  .glow-accent { box-shadow: 0 0 0 2px var(--accent-dim); border-color: var(--accent); }
}
```

- [ ] Commit:
```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: design tokens — bg scale, semantic colors, gemini gradient, fonts"
```

---

### Task 3: Root Layout + Fonts

**Files:** `app/layout.tsx`

- [ ] Write `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'EzQuant',
  description: 'Visual quant pipeline builder',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetBrainsMono.variable}`}>
      <body className="font-sans antialiased h-full">{children}</body>
    </html>
  )
}
```

- [ ] Write `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
export default function Home() { redirect('/projects') }
```

- [ ] Commit:
```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat: root layout with DM Sans + JetBrains Mono via next/font"
```

---

### Task 4: Shared Types

**Files:** `types/index.ts`

- [ ] Create `types/index.ts`:
```typescript
import type { Node, Edge } from '@xyflow/react'

// ── Block / Catalog ──────────────────────────────────────────────────────────
export type BlockCategory = 'data' | 'clean' | 'signal' | 'model' | 'eval'

export type BlockType =
  | 'ticker_source' | 'csv_upload'
  | 'drop_na' | 'log_returns' | 'resample' | 'z_score'
  | 'ema' | 'ems' | 'momentum' | 'rolling_corr'
  | 'linear_reg' | 'threshold_signal'
  | 'backtest' | 'equity_curve'

export type BlockStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped'

export interface ParamSchema {
  key: string
  label: string
  type: 'string' | 'number' | 'select' | 'boolean'
  default: string | number | boolean
  options?: string[]
  placeholder?: string
}

export interface BlockDefinition {
  type: BlockType
  category: BlockCategory
  label: string
  description?: string
  stretch?: boolean        // opacity-50 "coming soon" in palette
  paramsSchema: ParamSchema[]
}

// ── Node Data ────────────────────────────────────────────────────────────────
export interface DataQuality {
  rows: number
  dateRange: string
  missing: number
  nanCount: number
  lookaheadRisk: boolean
  sparkline?: number[]     // 0-1 normalised points for SVG polyline
}

export interface Metrics {
  sharpe: number
  maxDrawdown: number
  totalReturn: number
  annualizedReturn: number
  winRate?: number
}

export interface NodeData extends Record<string, unknown> {
  id: string               // stable; used as registry key
  name: string             // user-editable display name
  category: BlockCategory
  status: BlockStatus
  source?: 'user' | 'copilot'
  blockType: BlockType
  params: Record<string, string | number | boolean>
  quality?: DataQuality
  metrics?: Metrics
}

export interface EdgeData {
  label?: string
}

export type CanvasNode = Node<NodeData, BlockType>
export type CanvasEdge = Edge<EdgeData>

export interface PipelineGraph {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface RunResult {
  success: boolean
  metrics?: Metrics
  error?: string
  nodeStatuses: Record<string, BlockStatus>
}

// ── Projects / Templates ─────────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  sharpe: number
  blockCount: number
  status: 'healthy' | 'warning'
  updatedAt: string
  graph?: PipelineGraph
}

export type TemplateAccent = 'green' | 'blue' | 'amber'

export interface Template {
  id: string
  name: string
  description: string
  accentColor: TemplateAccent
  icon: string
  sharpe: number
  blockCount: number
  graph: PipelineGraph
}

// ── Copilot / Chat ───────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'agent' | 'system'
export type CopilotMode = 'ask' | 'suggest' | 'debug'

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'pdf' | 'csv' | 'other'
  file?: File
}

export interface ToolCall {
  tool: string
  summary: string
  status: 'running' | 'done' | 'error'
}

export interface Citation {
  num: number
  source: string
  url?: string
}

export interface Message {
  id: string
  role: MessageRole
  content?: string
  toolCalls?: ToolCall[]
  citations?: Citation[]
  appliedTemplate?: boolean
  attachmentNote?: string
  timestamp: Date
}

export type CopilotEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; summary: string }
  | { type: 'tool_result'; tool: string; summary: string }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'applied_banner' }
  | { type: 'suggest_pipeline_template'; graph: PipelineGraph }
  | { type: 'done' }

export interface PageContext {
  page: 'projects' | 'canvas' | 'gallery'
  projectId?: string
  projectName?: string
  blockCount?: number
  savedProjectCount?: number
  templateCount?: number
}
```

- [ ] Verify compiles: `npx tsc --noEmit 2>&1 | head -20`
- [ ] Commit: `git add types/index.ts && git commit -m "feat: shared TypeScript types"`

---

### Task 5: Mock Data

**Files:** `lib/mocks/mockProjects.ts`, `lib/mocks/mockMessages.ts`, `lib/mocks/mockTemplates.ts`, `lib/mocks/mockCanvasState.ts`

- [ ] Create `lib/mocks/mockCanvasState.ts` first (other mocks reference it):
```typescript
import type { PipelineGraph } from '@/types'

export const MOCK_NVDA_GRAPH: PipelineGraph = {
  nodes: [
    {
      id: 'n1', type: 'ticker_source', position: { x: 40, y: 40 },
      data: { id:'n1', name:'NVDA Source', category:'data', status:'idle', source:'copilot',
        blockType:'ticker_source', params:{ name:'NVDA Source', ticker:'NVDA', start_date:'2020-01-01', end_date:'2024-01-01', interval:'1d' },
        quality:{ rows:1008, dateRange:'20-01 → 24-01', missing:0, nanCount:0, lookaheadRisk:false,
          sparkline:[0.1,0.2,0.15,0.4,0.35,0.6,0.55,0.75,0.8,0.95] } },
    },
    {
      id: 'n2', type: 'log_returns', position: { x: 220, y: 40 },
      data: { id:'n2', name:'Log Returns', category:'clean', status:'idle', source:'copilot',
        blockType:'log_returns', params:{ col:'Close' } },
    },
    {
      id: 'n3', type: 'ema', position: { x: 220, y: 140 },
      data: { id:'n3', name:'EMA', category:'signal', status:'idle', source:'copilot',
        blockType:'ema', params:{ span:20 } },
    },
    {
      id: 'n4', type: 'threshold_signal', position: { x: 400, y: 90 },
      data: { id:'n4', name:'Threshold Sig', category:'model', status:'idle', source:'copilot',
        blockType:'threshold_signal', params:{ threshold:0.0, direction:'cross' } },
    },
    {
      id: 'n5', type: 'backtest', position: { x: 400, y: 190 },
      data: { id:'n5', name:'Backtest', category:'eval', status:'idle', source:'copilot',
        blockType:'backtest', params:{ cost_bps:1, initial_capital:100000 } },
    },
  ],
  edges: [
    { id:'e1-2', source:'n1', target:'n2', data:{} },
    { id:'e1-3', source:'n1', target:'n3', data:{} },
    { id:'e2-4', source:'n2', target:'n4', data:{} },
    { id:'e3-4', source:'n3', target:'n4', data:{} },
    { id:'e4-5', source:'n4', target:'n5', data:{} },
  ],
}

export const MOCK_AAPL_GRAPH: PipelineGraph = {
  nodes: [
    { id:'a1', type:'ticker_source', position:{x:40,y:60}, data:{id:'a1',name:'AAPL Source',category:'data',status:'success',source:'user',blockType:'ticker_source',params:{name:'AAPL Source',ticker:'AAPL',start_date:'2020-01-01',end_date:'2024-01-01',interval:'1d'}} },
    { id:'a2', type:'log_returns', position:{x:220,y:60}, data:{id:'a2',name:'Log Returns',category:'clean',status:'success',source:'user',blockType:'log_returns',params:{col:'Close'}} },
    { id:'a3', type:'ema', position:{x:400,y:60}, data:{id:'a3',name:'EMA',category:'signal',status:'success',source:'user',blockType:'ema',params:{span:20}} },
    { id:'a4', type:'threshold_signal', position:{x:580,y:60}, data:{id:'a4',name:'Threshold Sig',category:'model',status:'success',source:'user',blockType:'threshold_signal',params:{threshold:0.0,direction:'cross'}} },
    { id:'a5', type:'backtest', position:{x:760,y:60}, data:{id:'a5',name:'Backtest',category:'eval',status:'success',source:'user',blockType:'backtest',params:{cost_bps:1,initial_capital:100000}} },
  ],
  edges: [
    {id:'ae1',source:'a1',target:'a2',data:{}},{id:'ae2',source:'a2',target:'a3',data:{}},
    {id:'ae3',source:'a3',target:'a4',data:{}},{id:'ae4',source:'a4',target:'a5',data:{}},
  ],
}
```

- [ ] Create `lib/mocks/mockProjects.ts`:
```typescript
import type { Project } from '@/types'
import { MOCK_NVDA_GRAPH, MOCK_AAPL_GRAPH } from './mockCanvasState'

export const MOCK_PROJECTS: Project[] = [
  { id:'proj-1', name:'AAPL Momentum', sharpe:1.24, blockCount:5, status:'healthy', updatedAt:'2h ago', graph:MOCK_AAPL_GRAPH },
  { id:'proj-2', name:'SPY vs QQQ Pairs', sharpe:0.71, blockCount:8, status:'warning', updatedAt:'1d ago' },
  { id:'proj-3', name:'BTC Vol Filter', sharpe:-0.32, blockCount:7, status:'healthy', updatedAt:'3d ago' },
  { id:'proj-4', name:'NVDA Momentum', sharpe:1.67, blockCount:6, status:'healthy', updatedAt:'5h ago', graph:MOCK_NVDA_GRAPH },
]
```

- [ ] Create `lib/mocks/mockMessages.ts`:
```typescript
import type { Message } from '@/types'

export const MOCK_PROJECTS_MESSAGES: Message[] = [
  { id:'pm0', role:'agent', content:"Hey! I can answer finance questions, suggest pipeline templates, or help debug errors. Try /template momentum NVDA.", timestamp:new Date('2026-04-18T14:20:00') },
  { id:'pm1', role:'user', content:"What's a good Sharpe ratio for a momentum signal?", timestamp:new Date('2026-04-18T14:21:00') },
  { id:'pm2', role:'agent',
    content:'For daily-bar momentum on liquid equities, out-of-sample Sharpe 0.8–1.5 is realistic. Your AAPL project at 1.24 is healthy. Above 2.0 on vanilla momentum should raise suspicion of lookahead bias.',
    toolCalls:[{ tool:'search_knowledge', summary:'4 chunks · 0.3s', status:'done' }],
    citations:[{num:1,source:'finance_glossary.md'},{num:2,source:'hrt_benchmarks_blog'},{num:3,source:'js_signals_ema.md'}],
    timestamp:new Date('2026-04-18T14:21:05') },
]

export const MOCK_CANVAS_MESSAGES: Message[] = [
  { id:'cm1', role:'user', content:'Backtest a momentum strategy on NVDA', timestamp:new Date('2026-04-18T14:22:00') },
  { id:'cm2', role:'agent',
    content:"I put together a 5-block pipeline — fetch NVDA, compute log returns, apply a 20-day EMA, threshold to positions, and backtest. Span=20 is a common starting point; try 50 for slower signals.",
    toolCalls:[
      {tool:'search_knowledge',summary:'3 templates · 0.4s',status:'done'},
      {tool:'get_live_market_data',summary:'NVDA · 252 rows',status:'done'},
      {tool:'suggest_pipeline_template',summary:'5 blocks · json',status:'done'},
    ],
    appliedTemplate:true,
    citations:[{num:1,source:'momentum_template'},{num:2,source:'js_signals_ema'}],
    timestamp:new Date('2026-04-18T14:22:01') },
  { id:'cm3', role:'user', content:'Why span=20 and not 50?', timestamp:new Date('2026-04-18T14:22:30') },
  { id:'cm4', role:'agent',
    content:"Span=20 roughly matches a monthly lookback on daily data — the standard medium-term momentum horizon. Span=50 reduces turnover at the cost of signal speed. A/B them with two EMA blocks.",
    toolCalls:[{tool:'search_knowledge',summary:'5 chunks · 0.3s',status:'done'}],
    timestamp:new Date('2026-04-18T14:22:35') },
]

export const MOCK_GALLERY_MESSAGES: Message[] = [
  { id:'gm1', role:'user', content:'Can you build a pipeline based on this PDF?', attachmentNote:'📎 research_report.pdf · 12 pages', timestamp:new Date('2026-04-18T14:25:00') },
  { id:'gm2', role:'agent',
    content:'The paper describes a cross-sectional momentum factor with vol adjustment. I built a 6-block version: OHLCV → log returns → 12-1 momentum → vol-adjust → threshold → backtest. Click to load on a fresh canvas.',
    toolCalls:[
      {tool:'ingest_document',summary:'pdf · 47 chunks',status:'done'},
      {tool:'suggest_pipeline_template',summary:'derived · 6 blocks',status:'done'},
    ],
    citations:[{num:1,source:'research_report.pdf p.4'},{num:2,source:'research_report.pdf p.8'},{num:3,source:'xsec_momentum.md'}],
    timestamp:new Date('2026-04-18T14:25:05') },
]
```

- [ ] Create `lib/mocks/mockTemplates.ts`:
```typescript
import type { Template } from '@/types'
import { MOCK_NVDA_GRAPH, MOCK_AAPL_GRAPH } from './mockCanvasState'

export const MOCK_TEMPLATES: Template[] = [
  { id:'tpl-mom', name:'Momentum Signal', description:'EMA crossover on daily log returns with threshold', accentColor:'green', icon:'↗', sharpe:1.24, blockCount:5, graph:MOCK_AAPL_GRAPH },
  { id:'tpl-pairs', name:'Pairs Trade', description:'Rolling correlation mean-reversion on two tickers', accentColor:'blue', icon:'↔', sharpe:0.89, blockCount:6, graph:MOCK_NVDA_GRAPH },
  { id:'tpl-vol', name:'Vol Breakout', description:'Z-score vol regime filter with momentum entry', accentColor:'amber', icon:'⚡', sharpe:1.07, blockCount:7, graph:MOCK_NVDA_GRAPH },
]
```

- [ ] Commit: `git add lib/mocks && git commit -m "feat: mock data — projects, messages, templates, NVDA canvas state"`

---

### Task 6: API Placeholders

**Files:** `lib/api/placeholders.ts`

- [ ] Create `lib/api/placeholders.ts`:
```typescript
import type { CopilotEvent, Project, PipelineGraph, RunResult, PageContext, Attachment } from '@/types'
import { MOCK_PROJECTS } from '@/lib/mocks/mockProjects'
import { MOCK_NVDA_GRAPH } from '@/lib/mocks/mockCanvasState'

// TODO: wire to POST /api/agent/chat SSE endpoint
export async function* streamCopilotChat(
  message: string,
  _pageContext: PageContext,
  _attachments?: Attachment[]
): AsyncGenerator<CopilotEvent> {
  await delay(300)
  const isStrategyRequest = /backtest|momentum|strategy|pipeline|template/i.test(message)

  if (isStrategyRequest) {
    yield { type:'tool_use', tool:'search_knowledge', summary:'searching...' }
    await delay(300)
    yield { type:'tool_result', tool:'search_knowledge', summary:'3 templates · 0.4s' }
    yield { type:'tool_use', tool:'get_live_market_data', summary:'fetching...' }
    await delay(300)
    yield { type:'tool_result', tool:'get_live_market_data', summary:'NVDA · 252 rows' }
    yield { type:'tool_use', tool:'suggest_pipeline_template', summary:'generating...' }
    await delay(400)
    yield { type:'suggest_pipeline_template', graph:MOCK_NVDA_GRAPH }
    yield { type:'applied_banner' }
    yield { type:'text', content:"I put together a 5-block pipeline — fetch NVDA, compute log returns, apply a 20-day EMA, threshold to positions, and backtest. Span=20 is a common starting point." }
    yield { type:'citations', citations:[{num:1,source:'momentum_template'},{num:2,source:'js_signals_ema'}] }
  } else {
    yield { type:'tool_use', tool:'search_knowledge', summary:'searching...' }
    await delay(400)
    yield { type:'tool_result', tool:'search_knowledge', summary:'4 chunks · 0.3s' }
    yield { type:'text', content:`Placeholder response for: "${message}". Wire to POST /api/agent/chat to get real responses.` }
  }
  yield { type:'done' }
}

// TODO: wire to Supabase `projects` table
export async function fetchProjects(): Promise<Project[]> {
  await delay(150)
  return MOCK_PROJECTS
}

// TODO: wire to Supabase `projects` table
export async function fetchProject(id: string): Promise<Project> {
  await delay(150)
  const p = MOCK_PROJECTS.find(p => p.id === id) ?? MOCK_PROJECTS[3]
  return { ...p, graph: p.graph ?? MOCK_NVDA_GRAPH }
}

// TODO: wire to POST /api/pipeline/run
export async function runPipeline(graph: PipelineGraph): Promise<RunResult> {
  await delay(1800)
  return {
    success: true,
    metrics: { sharpe:1.67, maxDrawdown:-0.18, totalReturn:0.84, annualizedReturn:0.21, winRate:0.54 },
    nodeStatuses: Object.fromEntries(graph.nodes.map(n => [n.id, 'success' as const])),
  }
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }
```

- [ ] Commit: `git add lib/api/placeholders.ts && git commit -m "feat: typed API placeholder stubs with mock streaming"`

---

### Task 7: Block Catalog

**Files:** `lib/blocks/catalog.ts`

- [ ] Create `lib/blocks/catalog.ts`:
```typescript
import type { BlockDefinition, BlockCategory, BlockType } from '@/types'

export const BLOCK_CATALOG: BlockDefinition[] = [
  // Data
  { type:'ticker_source', category:'data', label:'Ticker Source', paramsSchema:[
    {key:'name',label:'Display Name',type:'string',default:'My Source',placeholder:'My Apple Source'},
    {key:'ticker',label:'Ticker',type:'string',default:'AAPL',placeholder:'AAPL'},
    {key:'start_date',label:'Start Date',type:'string',default:'2020-01-01'},
    {key:'end_date',label:'End Date',type:'string',default:'2024-01-01'},
    {key:'interval',label:'Interval',type:'select',default:'1d',options:['1d','1wk','1mo']},
  ]},
  { type:'csv_upload', category:'data', label:'CSV Upload', paramsSchema:[
    {key:'filename',label:'File',type:'string',default:'',placeholder:'data.csv'},
    {key:'date_col',label:'Date Column',type:'string',default:'Date'},
    {key:'price_col',label:'Price Column',type:'string',default:'Close'},
  ]},
  // Clean
  { type:'drop_na', category:'clean', label:'Drop NA', paramsSchema:[
    {key:'axis',label:'Axis',type:'select',default:'rows',options:['rows','cols']},
  ]},
  { type:'log_returns', category:'clean', label:'Log Returns', paramsSchema:[
    {key:'col',label:'Column',type:'string',default:'Close',placeholder:'Close'},
  ]},
  { type:'resample', category:'clean', label:'Resample', paramsSchema:[
    {key:'freq',label:'Frequency',type:'select',default:'1D',options:['1D','1W','1M']},
  ]},
  { type:'z_score', category:'clean', label:'Z-Score', paramsSchema:[
    {key:'window',label:'Window',type:'number',default:20},
  ]},
  // Signal
  { type:'ema', category:'signal', label:'EMA', paramsSchema:[
    {key:'span',label:'Span',type:'number',default:20},
  ]},
  { type:'ems', category:'signal', label:'EMS', paramsSchema:[
    {key:'span',label:'Span',type:'number',default:20},
    {key:'min_periods',label:'Min Periods',type:'number',default:0},
  ]},
  { type:'momentum', category:'signal', label:'Momentum', paramsSchema:[
    {key:'window',label:'Window',type:'number',default:20},
  ]},
  { type:'rolling_corr', category:'signal', label:'Rolling Corr', paramsSchema:[
    {key:'window',label:'Window',type:'number',default:30},
    {key:'other_col',label:'Other Column',type:'string',default:'spy',placeholder:'spy'},
  ]},
  // Model
  { type:'linear_reg', category:'model', label:'Linear Reg', paramsSchema:[
    {key:'target_col',label:'Target Column',type:'string',default:'returns'},
    {key:'feature_cols',label:'Feature Columns',type:'string',default:'ema,momentum'},
  ]},
  { type:'threshold_signal', category:'model', label:'Threshold Sig', paramsSchema:[
    {key:'threshold',label:'Threshold',type:'number',default:0.0},
    {key:'direction',label:'Direction',type:'select',default:'cross',options:['above','below','cross']},
  ]},
  // Eval
  { type:'backtest', category:'eval', label:'Backtest', paramsSchema:[
    {key:'cost_bps',label:'Cost (bps)',type:'number',default:1},
    {key:'initial_capital',label:'Initial Capital',type:'number',default:100000},
  ]},
  { type:'equity_curve', category:'eval', label:'Equity Curve', paramsSchema:[
    {key:'benchmark',label:'Benchmark',type:'string',default:'',placeholder:'SPY (optional)'},
  ]},
]

export const CATALOG_BY_TYPE: Record<string, BlockDefinition> = Object.fromEntries(
  BLOCK_CATALOG.map(b => [b.type, b])
)

export const CATEGORY_DOT: Record<BlockCategory, string> = {
  data:   'bg-eq-blue',
  clean:  'bg-eq-amber',
  signal: 'bg-eq-accent',
  model:  'bg-eq-green',
  eval:   'bg-eq-red',
}

export const CATEGORY_SECTIONS: { category: BlockCategory; label: string }[] = [
  { category:'data',   label:'Data'     },
  { category:'clean',  label:'Clean'    },
  { category:'signal', label:'Signal'   },
  { category:'model',  label:'Model'    },
  { category:'eval',   label:'Evaluate' },
]
```

- [ ] Commit: `git add lib/blocks/catalog.ts && git commit -m "feat: 14-block BLOCK_CATALOG with param schemas"`

---

### Task 8: Canvas Zustand Store

**Files:** `stores/canvasStore.ts`

- [ ] Create `stores/canvasStore.ts`:
```typescript
import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { NodeChange, EdgeChange } from '@xyflow/react'
import type { CanvasNode, CanvasEdge, BlockStatus } from '@/types'

interface CanvasStore {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeId: string | null
  setNodes: (nodes: CanvasNode[]) => void
  setEdges: (edges: CanvasEdge[]) => void
  addNodes: (nodes: CanvasNode[]) => void
  addEdges: (edges: CanvasEdge[]) => void
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void
  setSelected: (id: string | null) => void
  setStatuses: (statuses: Record<string, BlockStatus>) => void
  updateParam: (nodeId: string, key: string, value: string | number | boolean) => void
  clear: () => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: [], edges: [], selectedNodeId: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNodes: (n) => set((s) => ({ nodes: [...s.nodes, ...n] })),
  addEdges: (e) => set((s) => ({ edges: [...s.edges, ...e] })),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  setSelected: (id) => set({ selectedNodeId: id }),

  setStatuses: (statuses) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        statuses[n.id] ? { ...n, data: { ...n.data, status: statuses[n.id] } } : n
      ),
    })),

  updateParam: (nodeId, key, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
          : n
      ),
    })),

  clear: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}))
```

- [ ] Commit: `git add stores/canvasStore.ts && git commit -m "feat: canvasStore — nodes/edges/selection/statuses via Zustand"`

---

### Task 9: useCopilot Hook

**Files:** `hooks/useCopilot.ts`

- [ ] Create `hooks/useCopilot.ts`:
```typescript
'use client'
import { useState, useCallback } from 'react'
import { streamCopilotChat } from '@/lib/api/placeholders'
import type { Message, CopilotMode, Attachment, PageContext, PipelineGraph } from '@/types'

interface UseCopilotOptions {
  pageContext: PageContext
  initialMessages?: Message[]
  onPipelineGenerated?: (graph: PipelineGraph) => void
}

export function useCopilot({ pageContext, initialMessages = [], onPipelineGenerated }: UseCopilotOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [mode, setMode] = useState<CopilotMode>('ask')
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const addAttachment = useCallback((a: Attachment) => setAttachments(p => [...p, a]), [])
  const removeAttachment = useCallback((id: string) => setAttachments(p => p.filter(a => a.id !== id)), [])
  const clearMessages = useCallback(() => setMessages([]), [])

  const send = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = {
      id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date(),
      attachmentNote: attachments.length ? attachments.map(a => `📎 ${a.name}`).join(', ') : undefined,
    }
    setMessages(p => [...p, userMsg])
    setAttachments([])
    setIsStreaming(true)

    const agentId = crypto.randomUUID()
    setMessages(p => [...p, { id: agentId, role: 'agent', content: '', toolCalls: [], citations: [], timestamp: new Date() }])

    try {
      for await (const event of streamCopilotChat(text, pageContext, attachments)) {
        switch (event.type) {
          case 'text':
            setMessages(p => p.map(m => m.id === agentId ? { ...m, content: (m.content ?? '') + event.content } : m))
            break
          case 'tool_use':
            setMessages(p => p.map(m => m.id === agentId
              ? { ...m, toolCalls: [...(m.toolCalls ?? []), { tool: event.tool, summary: event.summary, status: 'running' as const }] }
              : m))
            break
          case 'tool_result':
            setMessages(p => p.map(m => m.id === agentId
              ? { ...m, toolCalls: (m.toolCalls ?? []).map(tc => tc.tool === event.tool ? { ...tc, summary: event.summary, status: 'done' as const } : tc) }
              : m))
            break
          case 'citations':
            setMessages(p => p.map(m => m.id === agentId ? { ...m, citations: event.citations } : m))
            break
          case 'applied_banner':
            setMessages(p => p.map(m => m.id === agentId ? { ...m, appliedTemplate: true } : m))
            break
          case 'suggest_pipeline_template':
            onPipelineGenerated?.(event.graph)
            break
          case 'done':
            break
        }
      }
    } catch {
      setMessages(p => p.map(m => m.id === agentId ? { ...m, content: 'Error — please try again.' } : m))
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, attachments, pageContext, onPipelineGenerated])

  return { messages, isStreaming, mode, setMode, send, attachments, addAttachment, removeAttachment, clearMessages }
}
```

- [ ] Commit: `git add hooks/useCopilot.ts && git commit -m "feat: useCopilot hook — consumes async generator, updates message thread"`

---

### Task 10: Copilot Sub-Components

**Files:** `components/copilot/ThinkingIndicator.tsx`, `ToolPill.tsx`, `CitationChip.tsx`, `AttachmentChip.tsx`, `AppliedBanner.tsx`, `MessageBubble.tsx`

- [ ] Create `components/copilot/ThinkingIndicator.tsx`:
```tsx
export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan animate-t1" />
      <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan animate-t2" />
      <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan animate-t3" />
    </div>
  )
}
```

- [ ] Create `components/copilot/ToolPill.tsx`:
```tsx
import type { ToolCall } from '@/types'

const TOOL_DOT: Record<string, string> = {
  search_knowledge: 'bg-eq-blue',
  get_live_market_data: 'bg-eq-green',
  suggest_pipeline_template: 'bg-eq-accent',
  ingest_document: 'bg-eq-blue',
}

export function ToolPill({ toolCall }: { toolCall: ToolCall }) {
  const dotClass = TOOL_DOT[toolCall.tool] ?? 'bg-eq-t3'
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-eq-t2 border bg-bg-3 ${toolCall.status === 'done' ? 'border-eq-green/30' : 'border-eq-border-2'}`}>
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
      <span>{toolCall.tool}</span>
      <span className="text-eq-t3 ml-auto pl-2">{toolCall.summary}</span>
    </div>
  )
}
```

- [ ] Create `components/copilot/CitationChip.tsx`:
```tsx
import type { Citation } from '@/types'

export function CitationChip({ citation }: { citation: Citation }) {
  return (
    <button className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono text-eq-t2 bg-bg-2 border border-eq-border hover:border-eq-border-2 hover:text-eq-t1 transition-colors">
      <span className="w-3 h-3 rounded-full bg-eq-accent-dim text-eq-accent text-[8px] flex items-center justify-center font-medium">{citation.num}</span>
      {citation.source}
    </button>
  )
}
```

- [ ] Create `components/copilot/AttachmentChip.tsx`:
```tsx
import type { Attachment } from '@/types'
import { X } from 'lucide-react'

export function AttachmentChip({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const iconClass = attachment.type === 'image' ? 'bg-eq-accent' : 'bg-eq-amber'
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-bg-3 border border-eq-border-2 text-[9px] font-mono text-eq-t2">
      <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${iconClass}`} />
      <span className="max-w-[120px] truncate">{attachment.name}</span>
      <button onClick={onRemove} className="text-eq-t3 hover:text-eq-t1 ml-0.5">
        <X size={10} />
      </button>
    </div>
  )
}
```

- [ ] Create `components/copilot/AppliedBanner.tsx`:
```tsx
export function AppliedBanner() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] text-eq-green border border-eq-green/25 bg-eq-green-dim">
      <span className="text-[11px]">✦</span>
      Applied to canvas — review and hit Run
    </div>
  )
}
```

- [ ] Create `components/copilot/MessageBubble.tsx`:
```tsx
import type { Message } from '@/types'
import { ToolPill } from './ToolPill'
import { CitationChip } from './CitationChip'
import { AppliedBanner } from './AppliedBanner'

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col gap-1">
        {message.attachmentNote && (
          <div className="self-end text-[10px] text-eq-t3 font-mono">{message.attachmentNote}</div>
        )}
        <div className="self-end max-w-[85%] px-2.5 py-1.5 rounded-lg rounded-br-sm text-[11px] leading-relaxed bg-bg-2 border border-eq-border text-eq-t1">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan" />
        <span className="text-[9px] uppercase tracking-wider text-eq-t3 font-mono">Copilot</span>
      </div>
      {message.toolCalls?.map((tc, i) => <ToolPill key={i} toolCall={tc} />)}
      {message.content && (
        <p className="text-[11px] leading-relaxed text-eq-t1">{message.content}</p>
      )}
      {message.appliedTemplate && <AppliedBanner />}
      {message.citations && message.citations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {message.citations.map((c, i) => <CitationChip key={i} citation={c} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit: `git add components/copilot && git commit -m "feat: copilot sub-components — ToolPill, CitationChip, MessageBubble, etc."`

---

### Task 11: CopilotPanel

**Files:** `components/copilot/CopilotPanel.tsx`

- [ ] Create `components/copilot/CopilotPanel.tsx`:
```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { Paperclip, Image, RotateCcw, Send } from 'lucide-react'
import { useCopilot } from '@/hooks/useCopilot'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { AttachmentChip } from './AttachmentChip'
import type { PageContext, Message, PipelineGraph, CopilotMode } from '@/types'

interface Props {
  pageContext: PageContext
  initialMessages?: Message[]
  onPipelineGenerated?: (graph: PipelineGraph) => void
  subtitle?: string
}

const SLASH_COMMANDS = ['/template', '/ask', '/debug']

export function CopilotPanel({ pageContext, initialMessages, onPipelineGenerated, subtitle = 'gemini-2.0-flash · rag' }: Props) {
  const { messages, isStreaming, mode, setMode, send, attachments, addAttachment, removeAttachment, clearMessages } = useCopilot({ pageContext, initialMessages, onPipelineGenerated })
  const [draft, setDraft] = useState('')
  const [showSlash, setShowSlash] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // ⌘K focuses composer via custom event
  useEffect(() => {
    const handler = () => textareaRef.current?.focus()
    document.addEventListener('focus-composer', handler)
    return () => document.removeEventListener('focus-composer', handler)
  }, [])

  const handleSend = () => {
    if (!draft.trim()) return
    send(draft)
    setDraft('')
    setShowSlash(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value)
    setShowSlash(e.target.value === '/')
  }

  const handleFileAttach = (type: 'image' | 'pdf') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = type === 'image' ? 'image/*' : '.pdf'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      addAttachment({ id: crypto.randomUUID(), name: file.name, type, file })
    }
    input.click()
  }

  const MODES: { id: CopilotMode; label: string }[] = [
    { id: 'ask', label: 'Ask' }, { id: 'suggest', label: 'Suggest' }, { id: 'debug', label: 'Debug' },
  ]

  const contextLabel = {
    projects: `Projects page · ${pageContext.savedProjectCount ?? 4} saved pipelines`,
    canvas:   `Canvas · ${pageContext.projectName ?? 'Untitled'} · ${pageContext.blockCount ?? 0} blocks`,
    gallery:  `Template gallery · ${pageContext.templateCount ?? 3} loaded`,
  }[pageContext.page]

  return (
    <div className="flex flex-col bg-bg-1 border-l border-eq-border overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-2 border-b border-eq-border flex-shrink-0">
        <div className="w-5 h-5 rounded-full bg-gemini flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">✦</div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-eq-t1">Quant Copilot</div>
          <div className="text-[9px] text-eq-t3 font-mono">{subtitle}</div>
        </div>
        <button onClick={clearMessages} className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-3 transition-colors">
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Context strip */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-eq-cyan-dim/30 border-b border-eq-border text-[10px] text-eq-cyan flex-shrink-0">
        <div className="w-1 h-1 rounded-full bg-eq-cyan flex-shrink-0" />
        Context: {contextLabel}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 px-2.5 py-1.5 border-b border-eq-border flex-shrink-0">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border ${
              mode === m.id
                ? 'text-eq-t1 bg-bg-3 border-eq-accent/35'
                : 'text-eq-t2 bg-bg-2 border-eq-border hover:text-eq-t1'
            }`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {messages.map(m => <MessageBubble key={m.id} message={m} />)}
        {isStreaming && <ThinkingIndicator />}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 p-2.5 border-t border-eq-border bg-bg-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {attachments.map(a => <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />)}
          </div>
        )}
        <div className="relative bg-bg-3 border border-eq-border-2 rounded-lg p-2 flex flex-col gap-1.5">
          {showSlash && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-bg-3 border border-eq-border-2 rounded-lg overflow-hidden shadow-xl z-10">
              {SLASH_COMMANDS.map(cmd => (
                <button key={cmd} onClick={() => { setDraft(cmd + ' '); setShowSlash(false); textareaRef.current?.focus() }}
                  className="w-full px-3 py-1.5 text-left text-[10px] font-mono text-eq-t2 hover:bg-bg-4 hover:text-eq-t1 transition-colors">
                  {cmd}
                </button>
              ))}
            </div>
          )}
          <textarea ref={textareaRef} value={draft} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder={`Ask anything, or /template /ask /debug`} rows={1}
            className="w-full bg-transparent border-none text-[11px] text-eq-t1 placeholder:text-eq-t3 font-sans outline-none resize-none leading-relaxed" />
          <div className="flex items-center gap-1">
            <button onClick={() => handleFileAttach('image')} className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-4 transition-colors">
              <Image size={12} />
            </button>
            <button onClick={() => handleFileAttach('pdf')} className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-4 transition-colors">
              <Paperclip size={12} />
            </button>
            <span className="text-[9px] text-eq-t3 font-mono ml-auto mr-1">/ for commands</span>
            <button onClick={handleSend} disabled={!draft.trim() || isStreaming}
              className="w-6 h-5 rounded bg-eq-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-eq-accent-2 transition-colors">
              <Send size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] Commit: `git add components/copilot/CopilotPanel.tsx && git commit -m "feat: CopilotPanel — thread, modes, slash commands, file attach, ⌘K listener"`

---

### Task 12: BlockNode

**Files:** `components/canvas/nodes/BlockNode.tsx`

- [ ] Create `components/canvas/nodes/BlockNode.tsx`:
```tsx
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CATEGORY_DOT } from '@/lib/blocks/catalog'
import type { NodeData } from '@/types'

const STATUS_DOT: Record<string, string> = {
  idle:    'bg-eq-t3',
  running: 'bg-eq-cyan animate-pulse',
  success: 'bg-eq-green',
  error:   'bg-eq-red',
  skipped: 'bg-eq-amber',
}

export function BlockNode({ data, selected }: NodeProps<NodeData>) {
  const isCopilot = data.source === 'copilot'
  return (
    <div className={`w-[130px] bg-bg-2 border rounded-[7px] text-[10px] cursor-pointer transition-all
      ${selected ? 'border-eq-accent shadow-[0_0_0_2px_rgba(139,125,255,0.14)]' : isCopilot ? 'border-eq-cyan shadow-[0_0_0_2px_rgba(34,211,238,0.12)]' : 'border-eq-border-2 hover:border-white/25'}`}>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-bg-4 !border !border-eq-border-2 !rounded-full" />
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-eq-border">
        <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${CATEGORY_DOT[data.category]}`} />
        <span className="flex-1 text-[8px] text-eq-t3 font-mono uppercase tracking-wider truncate">{data.blockType.replace(/_/g, ' ')}</span>
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[data.status]}`} />
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-medium text-eq-t1 mb-0.5 truncate">{data.name}</div>
        <div className="text-[9px] text-eq-t3 font-mono truncate">
          {Object.entries(data.params).slice(0, 1).map(([k, v]) => `${k}: ${v}`).join(' ')}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-bg-4 !border !border-eq-border-2 !rounded-full" />
    </div>
  )
}
```

- [ ] Commit: `git add components/canvas/nodes && git commit -m "feat: BlockNode — category dot, status indicator, copilot glow, handles"`

---

### Task 13: Canvas Component

**Files:** `components/canvas/Canvas.tsx`

- [ ] Create `components/canvas/Canvas.tsx`:
```tsx
'use client'
import { useCallback } from 'react'
import ReactFlow, { Background, BackgroundVariant, type NodeTypes } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from '@/stores/canvasStore'
import { BlockNode } from './nodes/BlockNode'

const NODE_TYPES: NodeTypes = {
  ticker_source: BlockNode, csv_upload: BlockNode,
  drop_na: BlockNode, log_returns: BlockNode, resample: BlockNode, z_score: BlockNode,
  ema: BlockNode, ems: BlockNode, momentum: BlockNode, rolling_corr: BlockNode,
  linear_reg: BlockNode, threshold_signal: BlockNode,
  backtest: BlockNode, equity_curve: BlockNode,
}

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, setSelected, selectedNodeId } = useCanvasStore()
  const isCopilotSuggested = nodes.some(n => n.data.source === 'copilot')

  const onNodeClick = useCallback((_: React.MouseEvent, node: { id: string }) => {
    setSelected(node.id)
  }, [setSelected])

  const onPaneClick = useCallback(() => setSelected(null), [setSelected])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const blockType = e.dataTransfer.getData('application/block-type')
    if (!blockType) return
    const bounds = e.currentTarget.getBoundingClientRect()
    // Subagent: import CATALOG_BY_TYPE, create a new CanvasNode and call useCanvasStore.getState().addNodes([newNode])
    // Position: { x: e.clientX - bounds.left - 65, y: e.clientY - bounds.top - 30 }
    // id: crypto.randomUUID(), data.status: 'idle', data.source: 'user'
    // data.params: default values from CATALOG_BY_TYPE[blockType].paramsSchema
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  return (
    <div className="relative w-full h-full" onDrop={onDrop} onDragOver={onDragOver}>
      {isCopilotSuggested && (
        <div className="absolute top-2.5 left-3 z-10 flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-eq-cyan bg-eq-cyan-dim border border-eq-cyan/25">
          <span>✦</span> Generated by Copilot
        </div>
      )}
      <div className="absolute bottom-3 right-3 z-10 text-[10px] font-mono text-eq-t3">⌘↵ run · ⌘K copilot</div>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick} onPaneClick={onPaneClick}
        nodeTypes={NODE_TYPES}
        fitView
        style={{ background: '#0b0d12' }}
        defaultEdgeOptions={{ style: { stroke: 'rgba(34,211,238,0.25)', strokeWidth: 1.3 }, animated: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.04)" />
      </ReactFlow>
    </div>
  )
}
```

**Important:** In `onDrop`, complete the node creation using `CATALOG_BY_TYPE` and `addNodes`:
```typescript
import { CATALOG_BY_TYPE } from '@/lib/blocks/catalog'
import type { CanvasNode } from '@/types'

// inside onDrop:
const def = CATALOG_BY_TYPE[blockType]
if (!def) return
const defaultParams = Object.fromEntries(def.paramsSchema.map(p => [p.key, p.default]))
const newNode: CanvasNode = {
  id: crypto.randomUUID(),
  type: blockType as CanvasNode['type'],
  position: { x: e.clientX - bounds.left - 65, y: e.clientY - bounds.top - 30 },
  data: { id: crypto.randomUUID(), name: def.label, category: def.category, status: 'idle', source: 'user', blockType: def.type, params: defaultParams },
}
useCanvasStore.getState().addNodes([newNode])
```

- [ ] Commit: `git add components/canvas/Canvas.tsx && git commit -m "feat: Canvas — ReactFlow with all 14 node types, drag-drop, copilot banner"`

---

### Task 14: BlockPalette

**Files:** `components/canvas/BlockPalette.tsx`

- [ ] Create `components/canvas/BlockPalette.tsx`:
```tsx
import { BLOCK_CATALOG, CATEGORY_SECTIONS, CATEGORY_DOT } from '@/lib/blocks/catalog'

export function BlockPalette() {
  const handleDragStart = (e: React.DragEvent, blockType: string) => {
    e.dataTransfer.setData('application/block-type', blockType)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div className="w-[145px] bg-bg-1 border-r border-eq-border overflow-y-auto flex-shrink-0 py-2.5 px-1.5">
      {CATEGORY_SECTIONS.map(({ category, label }) => {
        const blocks = BLOCK_CATALOG.filter(b => b.category === category)
        return (
          <div key={category} className="mb-3.5">
            <div className="text-[9px] font-medium text-eq-t3 uppercase tracking-[0.7px] px-1 mb-1">{label}</div>
            {blocks.map(block => (
              <div key={block.type}
                draggable
                onDragStart={(e) => handleDragStart(e, block.type)}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[10.5px] text-eq-t2 cursor-grab hover:bg-bg-3 hover:text-eq-t1 transition-all mb-px ${block.stretch ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${CATEGORY_DOT[category]}`} />
                {block.label}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] Commit: `git add components/canvas/BlockPalette.tsx && git commit -m "feat: BlockPalette — categorised drag sources from BLOCK_CATALOG"`

---

### Task 15: Inspector

**Files:** `components/canvas/Inspector.tsx`

- [ ] Create `components/canvas/Inspector.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { CATALOG_BY_TYPE } from '@/lib/blocks/catalog'

type Tab = 'data' | 'params' | 'eval'

export function Inspector() {
  const [tab, setTab] = useState<Tab>('data')
  const { nodes, selectedNodeId, updateParam } = useCanvasStore()
  const node = nodes.find(n => n.id === selectedNodeId)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'data', label: 'Data' }, { id: 'params', label: 'Params' }, { id: 'eval', label: 'Eval' },
  ]

  return (
    <div className="w-[180px] bg-bg-1 border-l border-eq-border flex-shrink-0 overflow-y-auto">
      <div className="flex border-b border-eq-border">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[10px] font-medium text-center border-b-2 transition-all ${tab === t.id ? 'text-eq-t1 border-eq-accent' : 'text-eq-t3 border-transparent hover:text-eq-t2'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-2.5">
        {!node ? (
          <p className="text-[10px] text-eq-t3 text-center mt-4">Select a node to inspect</p>
        ) : tab === 'data' ? (
          <DataTab node={node} />
        ) : tab === 'params' ? (
          <ParamsTab node={node} updateParam={updateParam} />
        ) : (
          <EvalTab node={node} />
        )}
      </div>
    </div>
  )
}

function DataTab({ node }: { node: ReturnType<typeof useCanvasStore.getState>['nodes'][0] }) {
  const q = node.data.quality
  return (
    <div>
      <div className="text-[11px] font-medium text-eq-t1 mb-2">{node.data.name}</div>
      {q ? (
        <>
          {[['Rows', q.rows.toLocaleString()], ['Range', q.dateRange], ['Missing', q.missing], ['NaNs', q.nanCount]].map(([label, value]) => (
            <div key={label as string} className="flex justify-between items-center py-1 border-b border-eq-border">
              <span className="text-[10px] text-eq-t2">{label}</span>
              <span className="text-[10px] font-mono text-eq-t1">{String(value)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-1 border-b border-eq-border">
            <span className="text-[10px] text-eq-t2">Lookahead</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${q.lookaheadRisk ? 'bg-eq-amber-dim text-eq-amber' : 'bg-eq-green-dim text-eq-green'}`}>
              {q.lookaheadRisk ? 'Check' : 'OK'}
            </span>
          </div>
          {q.sparkline && (
            <div className="mt-2 h-9 bg-bg-2 border border-eq-border rounded p-0.5">
              <svg width="100%" height="28">
                <polyline
                  points={q.sparkline.map((v, i) => `${(i / (q.sparkline!.length - 1)) * 100}%,${(1 - v) * 22}`).join(' ')}
                  fill="none" stroke="var(--green)" strokeWidth="1.3" />
              </svg>
            </div>
          )}
        </>
      ) : (
        <p className="text-[10px] text-eq-t3 mt-2">No data quality info available</p>
      )}
    </div>
  )
}

function ParamsTab({ node, updateParam }: {
  node: ReturnType<typeof useCanvasStore.getState>['nodes'][0]
  updateParam: (id: string, key: string, value: string | number | boolean) => void
}) {
  const def = CATALOG_BY_TYPE[node.data.blockType]
  if (!def) return <p className="text-[10px] text-eq-t3">Unknown block type</p>

  return (
    <div className="flex flex-col gap-2">
      {def.paramsSchema.map(schema => (
        <div key={schema.key}>
          <label className="text-[9px] text-eq-t3 uppercase tracking-wider">{schema.label}</label>
          {schema.type === 'select' ? (
            <select value={String(node.data.params[schema.key] ?? schema.default)}
              onChange={e => updateParam(node.id, schema.key, e.target.value)}
              className="w-full mt-0.5 bg-bg-3 border border-eq-border text-eq-t1 text-[10px] rounded px-1.5 py-1 font-mono outline-none">
              {schema.options?.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input type={schema.type === 'number' ? 'number' : 'text'}
              value={String(node.data.params[schema.key] ?? schema.default)}
              placeholder={schema.placeholder}
              onChange={e => updateParam(node.id, schema.key, schema.type === 'number' ? Number(e.target.value) : e.target.value)}
              className="w-full mt-0.5 bg-bg-3 border border-eq-border text-eq-t1 text-[10px] rounded px-1.5 py-1 font-mono outline-none placeholder:text-eq-t3" />
          )}
        </div>
      ))}
    </div>
  )
}

function EvalTab({ node }: { node: ReturnType<typeof useCanvasStore.getState>['nodes'][0] }) {
  const m = node.data.metrics
  if (!m) return <p className="text-[9px] text-eq-t3 text-center mt-4">Run pipeline to populate</p>
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { label: 'Sharpe', value: m.sharpe.toFixed(2), pos: m.sharpe > 0 },
        { label: 'Max DD', value: `${(m.maxDrawdown * 100).toFixed(1)}%`, pos: false },
        { label: 'Return', value: `${(m.totalReturn * 100).toFixed(1)}%`, pos: m.totalReturn > 0 },
        { label: 'Ann Ret', value: `${(m.annualizedReturn * 100).toFixed(1)}%`, pos: m.annualizedReturn > 0 },
      ].map(({ label, value, pos }) => (
        <div key={label} className="bg-bg-2 border border-eq-border rounded p-1.5">
          <div className="text-[8px] text-eq-t3 uppercase tracking-wider mb-0.5">{label}</div>
          <div className={`text-[14px] font-light font-mono ${pos ? 'text-eq-green' : 'text-eq-t1'}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] Commit: `git add components/canvas/Inspector.tsx && git commit -m "feat: Inspector — Data/Params/Eval tabs with live param editing"`

---

### Task 16: BottomDrawer

**Files:** `components/canvas/BottomDrawer.tsx`

- [ ] Create `components/canvas/BottomDrawer.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ConsoleEntry { ts: string; level: 'ok' | 'warn' | 'err' | 'info'; msg: string }

const INITIAL_CONSOLE: ConsoleEntry[] = [
  { ts:'14:22:01', level:'info', msg:'✦ Copilot applied template: momentum_nvda' },
  { ts:'14:22:01', level:'info', msg:'Pipeline loaded · 5 nodes · 6 edges' },
  { ts:'14:22:02', level:'warn', msg:'⚠ Potential lookahead in ema_1 — ask copilot' },
  { ts:'14:22:02', level:'ok',   msg:'Schema validated. Ready to run.' },
]

const LEVEL_CLASS: Record<ConsoleEntry['level'], string> = {
  ok: 'text-eq-green', warn: 'text-eq-amber', err: 'text-eq-red', info: 'text-eq-blue',
}

export function BottomDrawer() {
  const [collapsed, setCollapsed] = useState(false)
  const { nodes } = useCanvasStore()

  return (
    <div className={`bg-bg-1 border-t border-eq-border flex-shrink-0 transition-all ${collapsed ? 'h-7' : 'h-[110px]'}`}>
      <div className="flex items-center h-7 px-3 border-b border-eq-border">
        <span className="text-[10px] font-medium text-eq-t3 uppercase tracking-wider">Registry & Console</span>
        <button onClick={() => setCollapsed(c => !c)} className="ml-auto text-eq-t3 hover:text-eq-t1">
          {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      {!collapsed && (
        <div className="grid grid-cols-2 h-[calc(110px-28px)] overflow-hidden">
          {/* Registry */}
          <div className="border-r border-eq-border p-2 overflow-y-auto">
            <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="text-eq-blue">▣</span> Registry
            </div>
            {nodes.map(n => (
              <div key={n.id} className="flex items-center gap-2 py-0.5 border-b border-eq-border text-[10px] font-mono">
                <span className="text-eq-blue flex-1 truncate">{n.data.id}.df</span>
                <span className="text-eq-t3 text-[9px]">{n.data.status === 'success' ? '✓' : 'pending'}</span>
              </div>
            ))}
          </div>
          {/* Console */}
          <div className="p-2 overflow-y-auto">
            <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="text-eq-accent">›_</span> Console
            </div>
            {INITIAL_CONSOLE.map((line, i) => (
              <div key={i} className="flex gap-2 text-[10px] font-mono py-px">
                <span className="text-eq-t3 flex-shrink-0">{line.ts}</span>
                <span className={LEVEL_CLASS[line.level]}>{line.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] Commit: `git add components/canvas/BottomDrawer.tsx && git commit -m "feat: BottomDrawer — Registry + Console panes, collapsible"`

---

### Task 17: AppShell

**Files:** `components/layout/AppShell.tsx`

- [ ] Create `components/layout/AppShell.tsx`:
```tsx
'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Projects', href: '/projects' },
  { label: 'Canvas',   href: '/canvas'   },
  { label: 'Templates',href: '/gallery'  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('focus-composer'))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-bg-0 overflow-hidden">
      <nav className="flex items-center gap-1 px-4 py-2.5 bg-bg-1 border-b border-eq-border flex-shrink-0">
        <span className="text-[13px] font-semibold text-eq-t1 mr-4 tracking-tight">
          Ez<span className="text-gemini bg-clip-text" style={{WebkitTextFillColor:'transparent', background:'linear-gradient(135deg,#8b7dff,#22d3ee)', WebkitBackgroundClip:'text'}}>Quant</span>
        </span>
        {TABS.map(tab => (
          <Link key={tab.href} href={tab.href}
            className={`px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              pathname.startsWith(tab.href)
                ? 'text-eq-t1 bg-bg-3 border border-eq-border-2'
                : 'text-eq-t2 hover:text-eq-t1 hover:bg-bg-3'
            }`}>
            {tab.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-eq-t3 font-mono px-1.5 py-0.5 border border-eq-border-2 rounded bg-bg-2">⌘K</span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-eq-accent-dim text-eq-accent border border-eq-accent/25 rounded-md text-[11px] font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan" />
            Quant Copilot
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
```

- [ ] Commit: `git add components/layout/AppShell.tsx && git commit -m "feat: AppShell — nav tabs, ⌘K dispatcher, copilot badge"`

---

### Task 18: Projects Page

**Files:** `app/projects/page.tsx`

- [ ] Create `app/projects/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { CopilotPanel } from '@/components/copilot/CopilotPanel'
import { fetchProjects } from '@/lib/api/placeholders'
import { MOCK_TEMPLATES } from '@/lib/mocks/mockTemplates'
import { MOCK_PROJECTS_MESSAGES } from '@/lib/mocks/mockMessages'
import type { Project, PageContext } from '@/types'

const ACCENT_BAR: Record<string, string> = {
  green: 'bg-eq-green', blue: 'bg-eq-blue', amber: 'bg-eq-amber',
}
const ACCENT_BADGE: Record<string, string> = {
  green: 'bg-eq-green-dim text-eq-green', blue: 'bg-eq-blue-dim text-eq-blue', amber: 'bg-eq-amber-dim text-eq-amber',
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => { fetchProjects().then(setProjects) }, [])

  const ctx: PageContext = { page: 'projects', savedProjectCount: projects.length }

  return (
    <AppShell>
      <div className="h-full grid grid-cols-[1fr_320px] overflow-hidden">
        <div className="overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-[17px] font-medium text-eq-t1">Research Projects</h1>
              <p className="text-[12px] text-eq-t2 mt-0.5">Your saved pipelines</p>
            </div>
            <button onClick={() => router.push('/canvas/new')}
              className="bg-eq-accent text-white border-none px-3.5 py-1.5 rounded-[7px] text-[12px] font-medium hover:bg-eq-accent-2 transition-colors">
              + New Pipeline
            </button>
          </div>

          {/* Templates */}
          <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-[0.8px] mb-2.5">Quick start — templates</div>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {MOCK_TEMPLATES.map(tpl => (
              <div key={tpl.id} onClick={() => router.push(`/canvas/${tpl.id}`)}
                className="relative bg-bg-2 border border-eq-border rounded-[10px] p-3.5 cursor-pointer hover:border-eq-border-2 hover:bg-bg-3 transition-all overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${ACCENT_BAR[tpl.accentColor]}`} />
                <div className="text-base mb-1.5">{tpl.icon}</div>
                <div className="text-[12px] font-medium text-eq-t1 mb-1">{tpl.name}</div>
                <div className="text-[10px] text-eq-t2 leading-relaxed mb-1.5">{tpl.description}</div>
                <span className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded ${ACCENT_BADGE[tpl.accentColor]}`}>Sharpe {tpl.sharpe}</span>
              </div>
            ))}
          </div>

          {/* Saved projects */}
          <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-[0.8px] mb-2.5">Saved projects</div>
          <div className="grid grid-cols-2 gap-2.5">
            {projects.map(proj => (
              <div key={proj.id} onClick={() => router.push(`/canvas/${proj.id}`)}
                className="bg-bg-2 border border-eq-border rounded-[10px] p-3.5 cursor-pointer hover:border-eq-accent transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium text-eq-t1">{proj.name}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${proj.status === 'healthy' ? 'bg-eq-green' : 'bg-eq-amber'}`} />
                </div>
                <div className={`text-[19px] font-light font-mono mt-1.5 ${proj.sharpe < 0 ? 'text-eq-red' : 'text-eq-green'}`}>{proj.sharpe}</div>
                <div className="text-[9px] text-eq-t3 mb-2">Sharpe</div>
                <div className="flex items-center justify-between pt-2 border-t border-eq-border">
                  <span className="text-[10px] text-eq-t2 font-mono">{proj.blockCount} blocks</span>
                  <span className="text-[9px] text-eq-t3">{proj.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Copilot */}
        <CopilotPanel pageContext={ctx} initialMessages={MOCK_PROJECTS_MESSAGES} subtitle="gemini-2.0-flash · rag" />
      </div>
    </AppShell>
  )
}
```

- [ ] Commit: `git add app/projects && git commit -m "feat: Projects page — templates row, saved projects grid, CopilotPanel"`

---

### Task 19: Canvas Page

**Files:** `app/canvas/[id]/page.tsx`

- [ ] Create `app/canvas/[id]/page.tsx`:
```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Canvas } from '@/components/canvas/Canvas'
import { BlockPalette } from '@/components/canvas/BlockPalette'
import { Inspector } from '@/components/canvas/Inspector'
import { BottomDrawer } from '@/components/canvas/BottomDrawer'
import { CopilotPanel } from '@/components/copilot/CopilotPanel'
import { useCanvasStore } from '@/stores/canvasStore'
import { fetchProject, runPipeline } from '@/lib/api/placeholders'
import { MOCK_CANVAS_MESSAGES } from '@/lib/mocks/mockMessages'
import type { PageContext, PipelineGraph } from '@/types'
import { Play, Save, ChevronLeft } from 'lucide-react'

export default function CanvasPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { nodes, edges, setNodes, setEdges, selectedNodeId, setSelected, setStatuses } = useCanvasStore()
  const [projectName, setProjectName] = useState('Untitled')
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    fetchProject(id).then(proj => {
      setProjectName(proj.name)
      if (proj.graph) { setNodes(proj.graph.nodes); setEdges(proj.graph.edges) }
    })
    return () => useCanvasStore.getState().clear()
  }, [id, setNodes, setEdges])

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    // Cycle all nodes to running
    const runningStatuses = Object.fromEntries(nodes.map(n => [n.id, 'running' as const]))
    setStatuses(runningStatuses)
    // Stagger success
    nodes.forEach((n, i) => {
      setTimeout(() => {
        setStatuses({ [n.id]: 'success' })
      }, 280 * (i + 1))
    })
    setTimeout(() => setIsRunning(false), 280 * (nodes.length + 1))
  }, [nodes, setStatuses])

  const handlePipelineGenerated = useCallback((graph: PipelineGraph) => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [setNodes, setEdges])

  const isCopilotSuggested = nodes.some(n => n.data.source === 'copilot')
  const ctx: PageContext = { page: 'canvas', projectId: id, projectName, blockCount: nodes.length }

  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 h-11 bg-bg-1 border-b border-eq-border flex-shrink-0 text-[12px]">
          <span className="font-medium text-eq-t1">{projectName}</span>
          <span className="text-eq-t3">/</span>
          <span className="text-[11px] text-eq-t3">{nodes.length} blocks{isCopilotSuggested ? ' · gemini-suggested' : ''} · {isRunning ? 'running…' : 'not yet run'}</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => router.push('/projects')} className="flex items-center gap-1 px-2.5 py-1 bg-bg-3 text-eq-t2 border border-eq-border rounded text-[11px] hover:text-eq-t1 transition-colors">
              <ChevronLeft size={12} /> Projects
            </button>
            <button className="px-2.5 py-1 bg-bg-3 text-eq-t2 border border-eq-border rounded text-[11px] hover:text-eq-t1 transition-colors">Save</button>
            <button onClick={handleRun} disabled={isRunning || nodes.length === 0}
              className="flex items-center gap-1.5 px-4 py-1 bg-eq-green text-[#0a1a12] rounded text-[12px] font-semibold hover:bg-eq-green/90 disabled:opacity-50 transition-colors">
              <Play size={12} /> {isRunning ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 grid grid-cols-[145px_1fr_180px_280px] overflow-hidden min-h-0">
          <BlockPalette />
          <Canvas />
          <Inspector />
          <CopilotPanel pageContext={ctx} initialMessages={MOCK_CANVAS_MESSAGES} onPipelineGenerated={handlePipelineGenerated} subtitle="gemini-2.0-flash · agent" />
        </div>

        <BottomDrawer />
      </div>
    </AppShell>
  )
}
```

- [ ] Commit: `git add app/canvas && git commit -m "feat: Canvas page — 4-col layout, run animation, copilot pipeline wiring"`

---

### Task 20: Gallery Page

**Files:** `app/gallery/page.tsx`

- [ ] Create `app/gallery/page.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { CopilotPanel } from '@/components/copilot/CopilotPanel'
import { MOCK_TEMPLATES } from '@/lib/mocks/mockTemplates'
import { MOCK_GALLERY_MESSAGES } from '@/lib/mocks/mockMessages'
import type { PageContext } from '@/types'

const MINI_NODES: Record<string, { label: string; color: string; left: number; top: number }[]> = {
  'tpl-mom': [
    {label:'Ticker AAPL',color:'border-eq-blue',left:6,top:18},
    {label:'Log Returns',color:'border-eq-amber',left:90,top:46},
    {label:'EMA-20',color:'border-eq-accent',left:158,top:18},
    {label:'Backtest',color:'border-eq-green',left:210,top:46},
  ],
  'tpl-pairs': [
    {label:'SPY',color:'border-eq-blue',left:4,top:10},
    {label:'QQQ',color:'border-eq-blue',left:4,top:68},
    {label:'Roll Corr',color:'border-eq-accent',left:115,top:40},
    {label:'Backtest',color:'border-eq-green',left:215,top:40},
  ],
  'tpl-vol': [
    {label:'Ticker',color:'border-eq-blue',left:4,top:14},
    {label:'Log Ret',color:'border-eq-amber',left:4,top:62},
    {label:'Volatility',color:'border-eq-accent',left:100,top:30},
    {label:'Momentum',color:'border-eq-accent',left:100,top:72},
    {label:'Backtest',color:'border-eq-green',left:200,top:48},
  ],
}

export default function GalleryPage() {
  const router = useRouter()
  const ctx: PageContext = { page: 'gallery', templateCount: MOCK_TEMPLATES.length }

  return (
    <AppShell>
      <div className="h-full grid grid-cols-[1fr_320px] overflow-hidden">
        <div className="overflow-y-auto p-6">
          <div className="mb-5">
            <h1 className="text-[17px] font-medium text-eq-t1">Template Gallery</h1>
            <p className="text-[12px] text-eq-t2 mt-0.5">Pre-wired pipelines — or ask Copilot to generate one</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_TEMPLATES.map(tpl => (
              <div key={tpl.id} onClick={() => router.push(`/canvas/${tpl.id}`)}
                className="bg-bg-2 border border-eq-border rounded-[10px] overflow-hidden cursor-pointer hover:border-eq-accent transition-all">
                <div className="h-[110px] relative bg-bg-1 p-2 overflow-hidden">
                  {MINI_NODES[tpl.id]?.map((n, i) => (
                    <div key={i} style={{position:'absolute',left:n.left,top:n.top}}
                      className={`bg-bg-3 border-l-2 ${n.color} border border-eq-border-2 rounded px-1.5 py-0.5 text-[8px] font-mono text-eq-t2 whitespace-nowrap`}>
                      {n.label}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-eq-border">
                  <div className="text-[12px] font-medium text-eq-t1 mb-1">{tpl.name}</div>
                  <div className="text-[10px] text-eq-t2 leading-relaxed mb-1.5">{tpl.description}</div>
                  <div className="flex gap-2.5 text-[9px] font-mono">
                    <span><span className="text-eq-t3">Sharpe </span><span className="text-eq-green font-medium">{tpl.sharpe}</span></span>
                    <span className="text-eq-t3">{tpl.blockCount} blocks</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Generate with Copilot card */}
            <div className="bg-[linear-gradient(135deg,rgba(139,125,255,0.05),rgba(34,211,238,0.05))] border border-eq-cyan rounded-[10px] overflow-hidden cursor-pointer hover:border-eq-cyan/60 transition-all"
              onClick={() => document.dispatchEvent(new CustomEvent('focus-composer'))}>
              <div className="h-[110px] flex items-center justify-center bg-bg-1">
                <div className="text-center">
                  <div className="text-[22px] mb-1" style={{background:'linear-gradient(135deg,#8b7dff,#22d3ee)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>✦</div>
                  <div className="text-[11px] text-eq-cyan">Generate with Copilot</div>
                </div>
              </div>
              <div className="p-3 border-t border-eq-border">
                <div className="text-[12px] font-medium text-eq-t1 mb-1">Describe your strategy</div>
                <div className="text-[10px] text-eq-t2 leading-relaxed mb-1.5">Tell Copilot what you want — it'll build the pipeline for you.</div>
                <div className="text-[9px] font-mono text-eq-t3">Powered by Gemini</div>
              </div>
            </div>
          </div>
        </div>
        <CopilotPanel pageContext={ctx} initialMessages={MOCK_GALLERY_MESSAGES} subtitle="gemini-2.0-flash · multimodal" />
      </div>
    </AppShell>
  )
}
```

- [ ] Commit: `git add app/gallery && git commit -m "feat: Gallery page — template grid with mini-node previews, Copilot card"`

---

### Task 21: IMPLEMENTATION.md

**Files:** `docs/IMPLEMENTATION.md`

- [ ] Create `docs/IMPLEMENTATION.md`:

```markdown
# EzQuant Frontend — Implementation Reference

## Component Tree

```
AppShell (nav + ⌘K dispatcher)
├── /projects → ProjectsPage
│   ├── Template cards (MOCK_TEMPLATES)
│   ├── Project cards (fetchProjects placeholder)
│   └── CopilotPanel [pageContext: projects]
├── /canvas/[id] → CanvasPage
│   ├── TopBar (run button, project name)
│   ├── BlockPalette (drag sources)
│   ├── Canvas (ReactFlow)
│   │   └── BlockNode (all 14 types)
│   ├── Inspector (Data/Params/Eval tabs)
│   ├── CopilotPanel [pageContext: canvas, onPipelineGenerated]
│   └── BottomDrawer (Registry + Console)
└── /gallery → GalleryPage
    ├── Template grid with mini-node previews
    ├── Generate with Copilot card
    └── CopilotPanel [pageContext: gallery]
```

## State Ownership

| State | Owner | Notes |
|---|---|---|
| `nodes, edges` | `canvasStore` (Zustand) | Shared: Canvas, Inspector, BottomDrawer, Copilot callback |
| `selectedNodeId` | `canvasStore` | Inspector reads it |
| `messages, mode, attachments` | `useCopilot` hook | Local to each CopilotPanel |
| `isStreaming` | `useCopilot` hook | Controls ThinkingIndicator |
| `projects` | Local useState | ProjectsPage only |
| `isRunning` | Local useState | CanvasPage top bar |

## TODO Locations — Backend Wire-up

| File | Line | TODO |
|---|---|---|
| `lib/api/placeholders.ts` | 7 | `streamCopilotChat` → POST /api/agent/chat SSE |
| `lib/api/placeholders.ts` | 33 | `fetchProjects` → Supabase `projects` table |
| `lib/api/placeholders.ts` | 39 | `fetchProject` → Supabase `projects` table |
| `lib/api/placeholders.ts` | 45 | `runPipeline` → POST /api/pipeline/run |

## Swapping Placeholders for Real Endpoints

**`streamCopilotChat`:** Replace the mock async generator with a real SSE reader:
```typescript
const res = await fetch('/api/agent/chat', { method:'POST', body: JSON.stringify({ message, pageContext, attachments }) })
const reader = res.body!.getReader()
// parse SSE chunks and yield CopilotEvent objects
```

**`fetchProjects` / `fetchProject`:** Import Supabase client and query the `projects` table. Return shape must match `Project` type in `types/index.ts`.

**`runPipeline`:** POST the serialized graph to `/api/pipeline/run`, stream status updates back via SSE or polling, call `canvasStore.setStatuses()` as each node completes.

## ⌘K Flow

1. `AppShell` listens to `keydown` → dispatches `CustomEvent('focus-composer')`
2. Each `CopilotPanel` instance listens to `'focus-composer'` and calls `textareaRef.current?.focus()`
3. Only the visible panel's textarea will visually respond

## Run Animation Flow

1. `handleRun` in CanvasPage calls `setStatuses(all → 'running')`
2. `setTimeout` loop per node: `setStatuses({ [nodeId]: 'success' })` with 280ms stagger
3. `BlockNode` reads `data.status` and applies `STATUS_DOT` class
4. When backend is wired: replace timeouts with real status polling from `runPipeline` result
```

- [ ] Commit: `git add docs/IMPLEMENTATION.md && git commit -m "docs: IMPLEMENTATION.md — component tree, state map, TODO wire-up guide"`

---

### Task 22: Final Verification

- [ ] Type-check: `npx tsc --noEmit 2>&1`
- [ ] Fix any type errors (common: missing `'use client'`, incorrect import paths, xyflow type mismatches on `NodeProps`)
- [ ] Start dev server: `npm run dev`
- [ ] Open http://localhost:3000 — should redirect to /projects
- [ ] Verify: projects page renders with template cards + project grid + copilot panel
- [ ] Navigate to /canvas/proj-4 — NVDA momentum graph should load with 5 nodes
- [ ] Click Run — nodes should cycle gray → blue → green with stagger
- [ ] Type a message in copilot + Enter — mock stream should show tool pills then text
- [ ] Attach an image — AttachmentChip should appear, clear on send
- [ ] Navigate to /gallery — 4-card grid with mini-node previews
- [ ] Commit final: `git add -A && git commit -m "feat: complete EzQuant frontend — all pages, components, mocks wired"`
