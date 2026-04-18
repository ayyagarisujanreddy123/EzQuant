'use client'
import { useState, useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { CATALOG_BY_TYPE } from '@/lib/blocks/catalog'
import { fetchOhlcv } from '@/lib/api/backend'
import type { CanvasNode, DataQuality, OhlcvBar } from '@/types'
import { Download, Loader2, Play } from 'lucide-react'

type Tab = 'data' | 'params' | 'eval'

const TABS: { id: Tab; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'params', label: 'Params' },
  { id: 'eval', label: 'Eval' },
]

export function Inspector() {
  const [tab, setTab] = useState<Tab>('data')
  const { nodes, selectedNodeId, updateParam, patchNodeData, setStatuses } =
    useCanvasStore()
  const node = nodes.find((n) => n.id === selectedNodeId)

  // Auto-switch to Params tab when a node is selected
  useEffect(() => {
    if (selectedNodeId) setTab('params')
  }, [selectedNodeId])

  return (
    <div className="w-[180px] bg-bg-1 border-l border-eq-border flex-shrink-0 overflow-y-auto">
      <div className="flex border-b border-eq-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[10px] font-medium text-center border-b-2 transition-all ${
              tab === t.id
                ? 'text-eq-t1 border-eq-accent'
                : 'text-eq-t3 border-transparent hover:text-eq-t2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-2.5">
        {!node ? (
          <p className="text-[10px] text-eq-t3 text-center mt-4">
            Select a node to inspect
          </p>
        ) : tab === 'data' ? (
          <DataTab node={node} />
        ) : tab === 'params' ? (
          <ParamsTab
            node={node}
            updateParam={updateParam}
            onEvaluate={async () => {
              if (node.data.blockType !== 'ticker_source') return
              const p = node.data.params
              setStatuses({ [node.id]: 'running' })
              patchNodeData(node.id, { fetchError: undefined })
              try {
                const res = await fetchOhlcv({
                  symbol: String(p.ticker ?? ''),
                  interval: String(p.interval ?? '1d'),
                  start: String(p.start_date ?? ''),
                  end: String(p.end_date ?? ''),
                })
                const quality = barsToQuality(res.bars)
                patchNodeData(node.id, {
                  bars: res.bars,
                  quality,
                  fetchError: undefined,
                })
                setStatuses({ [node.id]: 'success' })
                setTab('data')
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Fetch failed'
                patchNodeData(node.id, { fetchError: msg, bars: undefined, quality: undefined })
                setStatuses({ [node.id]: 'error' })
                setTab('data')
              }
            }}
          />
        ) : (
          <EvalTab node={node} />
        )}
      </div>
    </div>
  )
}

function DataTab({ node }: { node: CanvasNode }) {
  const q = node.data.quality
  const err = node.data.fetchError
  const bars = node.data.bars
  const isRunning = node.data.status === 'running'

  const handleDownloadCsv = () => {
    if (!bars?.length) return
    const symbol = String(node.data.params.ticker ?? node.data.name ?? 'data')
    downloadBarsAsCsv(bars, symbol)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-medium text-eq-t1 truncate">{node.data.name}</div>
        {bars && bars.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            title="Download CSV"
            className="flex items-center gap-1 text-[9px] font-mono text-eq-cyan hover:text-eq-t1 border border-eq-cyan/30 hover:border-eq-cyan bg-eq-cyan-dim/50 rounded px-1.5 py-0.5 transition-colors"
          >
            <Download size={10} /> CSV
          </button>
        )}
      </div>

      {isRunning && (
        <div className="flex items-center gap-1.5 text-[10px] text-eq-cyan py-2">
          <Loader2 size={11} className="animate-spin" /> Fetching…
        </div>
      )}

      {err && !isRunning && (
        <div className="text-[10px] text-eq-red bg-eq-red-dim border border-eq-red/25 rounded px-2 py-1.5 mb-2 font-mono break-words">
          {err}
        </div>
      )}

      {q ? (
        <>
          {[
            ['Rows', q.rows.toLocaleString()],
            ['Range', q.dateRange],
            ['Missing', q.missing],
            ['NaNs', q.nanCount],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="flex justify-between items-center py-1 border-b border-eq-border"
            >
              <span className="text-[10px] text-eq-t2">{label}</span>
              <span className="text-[10px] font-mono text-eq-t1">{String(value)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-1 border-b border-eq-border">
            <span className="text-[10px] text-eq-t2">Lookahead</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded ${
                q.lookaheadRisk
                  ? 'bg-eq-amber-dim text-eq-amber'
                  : 'bg-eq-green-dim text-eq-green'
              }`}
            >
              {q.lookaheadRisk ? 'Check' : 'OK'}
            </span>
          </div>
          {q.sparkline && q.sparkline.length > 1 && (
            <div className="mt-2 h-9 bg-bg-2 border border-eq-border rounded p-0.5">
              <svg width="100%" height="28" viewBox="0 0 100 28" preserveAspectRatio="none">
                <polyline
                  points={q.sparkline
                    .map(
                      (v, i) =>
                        `${(i / (q.sparkline!.length - 1)) * 100},${(1 - v) * 24 + 2}`
                    )
                    .join(' ')}
                  fill="none"
                  stroke="#2dd4a0"
                  strokeWidth="1.3"
                />
              </svg>
            </div>
          )}
        </>
      ) : (
        !isRunning &&
        !err && (
          <p className="text-[10px] text-eq-t3 mt-2">
            No data yet. Click <span className="text-eq-accent">Evaluate</span> in Params to fetch.
          </p>
        )
      )}
    </div>
  )
}

function ParamsTab({
  node,
  updateParam,
  onEvaluate,
}: {
  node: CanvasNode
  updateParam: (id: string, key: string, value: string | number | boolean) => void
  onEvaluate: () => void | Promise<void>
}) {
  const def = CATALOG_BY_TYPE[node.data.blockType]
  const isTicker = node.data.blockType === 'ticker_source'
  const isRunning = node.data.status === 'running'

  if (!def) return <p className="text-[10px] text-eq-t3">Unknown block type</p>

  return (
    <div className="flex flex-col gap-2">
      {def.paramsSchema.map((schema) => {
        const current = node.data.params[schema.key] ?? schema.default
        return (
          <div key={schema.key}>
            <label className="text-[9px] text-eq-t3 uppercase tracking-wider">
              {schema.label}
            </label>
            {schema.type === 'select' ? (
              <select
                value={String(current)}
                onChange={(e) => updateParam(node.id, schema.key, e.target.value)}
                className="w-full mt-0.5 bg-bg-3 border border-eq-border text-eq-t1 text-[10px] rounded px-1.5 py-1 font-mono outline-none"
              >
                {schema.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={schema.type === 'number' ? 'number' : 'text'}
                value={String(current)}
                placeholder={schema.placeholder}
                onChange={(e) =>
                  updateParam(
                    node.id,
                    schema.key,
                    schema.type === 'number' ? Number(e.target.value) : e.target.value
                  )
                }
                className="w-full mt-0.5 bg-bg-3 border border-eq-border text-eq-t1 text-[10px] rounded px-1.5 py-1 font-mono outline-none placeholder:text-eq-t3"
              />
            )}
          </div>
        )
      })}

      {isTicker && (
        <button
          type="button"
          onClick={onEvaluate}
          disabled={isRunning}
          className="mt-2 flex items-center justify-center gap-1.5 bg-eq-accent text-white text-[11px] font-medium py-1.5 rounded hover:bg-eq-accent-2 disabled:opacity-50 transition-colors"
        >
          {isRunning ? (
            <>
              <Loader2 size={12} className="animate-spin" /> Evaluating…
            </>
          ) : (
            <>
              <Play size={12} /> Evaluate
            </>
          )}
        </button>
      )}
    </div>
  )
}

function EvalTab({ node }: { node: CanvasNode }) {
  const m = node.data.metrics
  if (!m)
    return (
      <p className="text-[9px] text-eq-t3 text-center mt-4">
        Run pipeline to populate
      </p>
    )
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { label: 'Sharpe', value: m.sharpe.toFixed(2), pos: m.sharpe > 0 },
        { label: 'Max DD', value: `${(m.maxDrawdown * 100).toFixed(1)}%`, pos: false },
        { label: 'Return', value: `${(m.totalReturn * 100).toFixed(1)}%`, pos: m.totalReturn > 0 },
        {
          label: 'Ann Ret',
          value: `${(m.annualizedReturn * 100).toFixed(1)}%`,
          pos: m.annualizedReturn > 0,
        },
      ].map(({ label, value, pos }) => (
        <div key={label} className="bg-bg-2 border border-eq-border rounded p-1.5">
          <div className="text-[8px] text-eq-t3 uppercase tracking-wider mb-0.5">
            {label}
          </div>
          <div
            className={`text-[14px] font-light font-mono ${pos ? 'text-eq-green' : 'text-eq-t1'}`}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function barsToQuality(bars: OhlcvBar[]): DataQuality {
  if (!bars.length) {
    return { rows: 0, dateRange: '—', missing: 0, nanCount: 0, lookaheadRisk: false }
  }
  const first = bars[0].timestamp.slice(2, 7) // "26-04" from "2026-04-18..."
  const last = bars[bars.length - 1].timestamp.slice(2, 7)
  const closes = bars.map((b) => b.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const targetSamples = 20
  const step = Math.max(1, Math.floor(bars.length / targetSamples))
  const sparkline: number[] = []
  for (let i = 0; i < bars.length; i += step) {
    sparkline.push((closes[i] - min) / range)
  }
  if (sparkline[sparkline.length - 1] !== (closes[closes.length - 1] - min) / range) {
    sparkline.push((closes[closes.length - 1] - min) / range)
  }
  const missing = bars.filter((b) => b.close == null || Number.isNaN(b.close)).length
  return {
    rows: bars.length,
    dateRange: `${first} → ${last}`,
    missing,
    nanCount: missing,
    lookaheadRisk: false,
    sparkline,
  }
}

function downloadBarsAsCsv(bars: OhlcvBar[], symbol: string) {
  const headers: (keyof OhlcvBar)[] = [
    'timestamp',
    'open',
    'high',
    'low',
    'close',
    'volume',
    'adj_close',
  ]
  const lines = [
    headers.join(','),
    ...bars.map((b) => headers.map((h) => String(b[h] ?? '')).join(',')),
  ]
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const ts = new Date().toISOString().slice(0, 10)
  a.download = `${symbol.toUpperCase()}_${ts}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
