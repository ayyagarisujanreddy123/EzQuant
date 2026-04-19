'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { CopilotPanel } from '@/components/copilot/CopilotPanel'
import { MOCK_TEMPLATES } from '@/lib/mocks/mockTemplates'
import { createProject } from '@/lib/api/placeholders'
import type { PageContext, Template, BlockCategory } from '@/types'
import { Loader2, Search, Sparkles, Blocks, TrendingUp, X } from 'lucide-react'

const CATEGORY_STROKE: Record<BlockCategory, string> = {
  data: '#3b82f6',
  clean: '#f59e0b',
  signal: '#22d3ee',
  model: '#22c55e',
  eval: '#ef4444',
}

const SHORT_LABEL: Record<string, string> = {
  universe: 'Universe',
  csv_upload: 'CSV',
  log_returns: 'Log Ret',
  forward_return: 'Fwd Ret',
  ema: 'EMA',
  momentum: 'Mom',
  signal: 'Signal',
  signal_diagnostics: 'IC',
  position_sizer: 'Position',
  backtest: 'Backtest',
}

type Filter = 'all' | 'momentum' | 'diagnostics'

function extractTicker(tpl: Template): string | null {
  const src = tpl.graph.nodes.find((n) => n.data.blockType === 'universe')
  const raw = src?.data.params?.symbol
  return typeof raw === 'string' ? raw.split(',')[0].trim().toUpperCase() : null
}

function extractCategories(tpl: Template): BlockCategory[] {
  const seen = new Set<BlockCategory>()
  for (const n of tpl.graph.nodes) seen.add(n.data.category)
  return Array.from(seen)
}

function sharpeColor(s: number): string {
  if (s >= 1) return 'text-eq-green bg-eq-green-dim border-eq-green/30'
  if (s >= 0.4) return 'text-eq-amber bg-eq-amber-dim border-eq-amber/30'
  return 'text-eq-red bg-eq-red-dim border-eq-red/30'
}

function matchesFilter(tpl: Template, f: Filter): boolean {
  if (f === 'all') return true
  const hasDiag = tpl.graph.nodes.some((n) => n.data.blockType === 'signal_diagnostics')
  if (f === 'diagnostics') return hasDiag
  if (f === 'momentum') return !hasDiag
  return true
}

/**
 * Mini pipeline preview: lays out the template's nodes on a 2-row SVG and draws
 * the actual edges, so the card thumbnail reflects real topology.
 */
function PipelinePreview({ tpl }: { tpl: Template }) {
  const W = 292
  const H = 108
  const { nodes, edges } = tpl.graph
  const max = Math.min(nodes.length, 8)
  const shown = nodes.slice(0, max)
  const idToIndex = new Map(shown.map((n, i) => [n.id, i]))

  const cols = Math.min(max, 5)
  const rows = max > 5 ? 2 : 1
  const colW = (W - 24) / cols
  const rowH = rows === 1 ? H - 24 : (H - 24) / rows
  const positions = shown.map((_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      x: 12 + col * colW + colW / 2,
      y: 12 + row * rowH + rowH / 2,
    }
  })

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(34,211,238,0.04)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#bgGrad)" />
      {edges.map((e, i) => {
        const a = idToIndex.get(e.source)
        const b = idToIndex.get(e.target)
        if (a === undefined || b === undefined) return null
        const p1 = positions[a]
        const p2 = positions[b]
        const mx = (p1.x + p2.x) / 2
        const d = `M ${p1.x} ${p1.y} C ${mx} ${p1.y}, ${mx} ${p2.y}, ${p2.x} ${p2.y}`
        return (
          <path
            key={i}
            d={d}
            stroke="rgba(34,211,238,0.35)"
            strokeWidth={1.2}
            fill="none"
          />
        )
      })}
      {shown.map((n, i) => {
        const { x, y } = positions[i]
        const stroke = CATEGORY_STROKE[n.data.category] ?? '#7c8699'
        const label = SHORT_LABEL[n.data.blockType] ?? n.data.name
        const w = Math.max(36, label.length * 5.2 + 12)
        return (
          <g key={n.id} transform={`translate(${x - w / 2}, ${y - 10})`}>
            <rect
              width={w}
              height={20}
              rx={4}
              ry={4}
              fill="#12151d"
              stroke={stroke}
              strokeOpacity={0.7}
              strokeWidth={1}
            />
            <rect width={2.5} height={20} fill={stroke} rx={1} />
            <text
              x={w / 2}
              y={13}
              textAnchor="middle"
              fontSize={8.5}
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="#cbd5e1"
            >
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function GalleryPage() {
  const router = useRouter()
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const ctx: PageContext = {
    page: 'gallery',
    templateCount: MOCK_TEMPLATES.length,
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return MOCK_TEMPLATES.filter((t) => matchesFilter(t, filter)).filter((t) => {
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        (extractTicker(t) ?? '').toLowerCase().includes(q)
      )
    })
  }, [query, filter])

  const handleTemplateClick = async (tpl: Template) => {
    if (creatingId) return
    setCreatingId(tpl.id)
    try {
      const project = await createProject({ name: tpl.name, graph: tpl.graph })
      router.push(`/canvas/${project.id}`)
    } catch (err) {
      console.error('template clone failed', err)
      setCreatingId(null)
      alert(
        'Could not create project from template: ' +
          (err instanceof Error ? err.message : String(err))
      )
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-hidden">
        <div className="h-full overflow-y-auto">
          <div className="max-w-6xl mx-auto p-6 pb-16">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={16} className="text-eq-cyan" />
                  <h1 className="text-[20px] font-semibold text-eq-t1 tracking-tight">
                    Template Gallery
                  </h1>
                </div>
                <p className="text-[12px] text-eq-t2 max-w-lg leading-relaxed">
                  Pre-wired pipelines you can clone and run in one click — or ask{' '}
                  <span className="text-eq-cyan">Bloom</span> to generate a custom one from a
                  natural-language goal.
                </p>
              </div>
              <div className="hidden md:flex items-center gap-3 text-[10px] font-mono text-eq-t3">
                <span>
                  <span className="text-eq-t2 font-medium">{MOCK_TEMPLATES.length}</span> templates
                </span>
                <span className="h-3 w-px bg-eq-border" />
                <span>signal-first research</span>
              </div>
            </div>

            <div className="mb-5 flex flex-col md:flex-row md:items-center gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-eq-t3"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, ticker, or description"
                  className="w-full bg-bg-2 border border-eq-border rounded-md pl-7 pr-7 py-1.5 text-[12px] text-eq-t1 placeholder:text-eq-t3 focus:outline-none focus:border-eq-accent transition-colors"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-eq-t3 hover:text-eq-t1"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'momentum', 'diagnostics'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors border ${
                      filter === f
                        ? 'bg-eq-cyan-dim text-eq-cyan border-eq-cyan/40'
                        : 'bg-bg-2 text-eq-t2 border-eq-border hover:text-eq-t1 hover:border-eq-border-2'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((tpl) => {
                const busy = creatingId === tpl.id
                const ticker = extractTicker(tpl)
                const cats = extractCategories(tpl)
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleTemplateClick(tpl)}
                    className={`group bg-bg-2 border border-eq-border rounded-[10px] overflow-hidden cursor-pointer transition-all duration-150 hover:border-eq-cyan/60 hover:shadow-[0_4px_20px_-8px_rgba(34,211,238,0.35)] hover:-translate-y-[1px] ${
                      busy ? 'opacity-70 pointer-events-none' : ''
                    }`}
                  >
                    <div className="h-[118px] relative bg-bg-1 overflow-hidden border-b border-eq-border">
                      <PipelinePreview tpl={tpl} />
                      {ticker && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-bg-3/90 border border-eq-border-2 text-[9px] font-mono font-medium text-eq-t1 tracking-wider">
                          {ticker}
                        </div>
                      )}
                      <div
                        className={`absolute top-2 right-2 px-1.5 py-0.5 rounded border text-[9px] font-mono font-medium flex items-center gap-0.5 ${sharpeColor(
                          tpl.sharpe
                        )}`}
                        title="Backtest Sharpe ratio"
                      >
                        <TrendingUp size={9} strokeWidth={2.5} />
                        {tpl.sharpe.toFixed(2)}
                      </div>
                      {busy && (
                        <div className="absolute inset-0 flex items-center justify-center bg-bg-1/70 backdrop-blur-[1px]">
                          <div className="flex items-center gap-1.5 text-[10px] text-eq-cyan font-mono">
                            <Loader2 size={12} className="animate-spin" />
                            Cloning…
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="text-[12.5px] font-semibold text-eq-t1 group-hover:text-eq-cyan transition-colors">
                          {tpl.name}
                        </div>
                        <div className="flex items-center gap-1 text-[9px] font-mono text-eq-t3 flex-shrink-0 pt-0.5">
                          <Blocks size={9} />
                          {tpl.blockCount}
                        </div>
                      </div>
                      <div className="text-[10.5px] text-eq-t2 leading-relaxed mb-2 line-clamp-2 min-h-[28px]">
                        {tpl.description}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cats.map((c) => (
                          <span
                            key={c}
                            className="text-[8.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-bg-3 text-eq-t3 border border-eq-border"
                            style={{
                              borderLeftColor: CATEGORY_STROKE[c],
                              borderLeftWidth: 2,
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}

              <div
                onClick={() =>
                  document.dispatchEvent(new CustomEvent('focus-composer'))
                }
                className="relative group bg-gradient-to-br from-eq-accent/10 via-bg-2 to-eq-cyan/10 border border-eq-cyan/40 rounded-[10px] overflow-hidden cursor-pointer hover:border-eq-cyan transition-all duration-150 hover:-translate-y-[1px] hover:shadow-[0_4px_20px_-8px_rgba(34,211,238,0.5)]"
              >
                <div className="h-[118px] relative flex items-center justify-center bg-bg-1 border-b border-eq-border overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,211,238,0.08),transparent_60%)]" />
                  <div className="relative text-center">
                    <div className="text-[28px] mb-1 text-gemini animate-pulse">✦</div>
                    <div className="text-[11px] text-eq-cyan font-medium">
                      Generate with Bloom
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles size={11} className="text-eq-cyan" />
                    <div className="text-[12.5px] font-semibold text-eq-t1">
                      Describe your strategy
                    </div>
                  </div>
                  <div className="text-[10.5px] text-eq-t2 leading-relaxed mb-2 line-clamp-2 min-h-[28px]">
                    Tell Bloom what you want — &quot;backtest EMA-20 momentum on
                    NVDA&quot; — and it will build the pipeline for you.
                  </div>
                  <div className="text-[9px] font-mono text-eq-t3">
                    gemini-2.5-flash · agent
                  </div>
                </div>
              </div>
            </div>

            {filtered.length === 0 && (
              <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
                <div className="text-[28px] text-eq-t3 mb-2">∅</div>
                <div className="text-[13px] text-eq-t1 font-medium mb-1">
                  No templates match
                </div>
                <div className="text-[11px] text-eq-t2 mb-4">
                  Try a different query or ask Bloom to generate one.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setFilter('all')
                  }}
                  className="px-3 py-1 bg-bg-3 border border-eq-border text-eq-t2 text-[11px] rounded-md hover:text-eq-t1 hover:border-eq-border-2 transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
        <CopilotPanel pageContext={ctx} subtitle="gemini-2.5-flash · rag" />
      </div>
    </AppShell>
  )
}
