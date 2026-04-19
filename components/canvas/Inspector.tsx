'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useCanvasStore } from '@/stores/canvasStore'
import { CATALOG_BY_TYPE, EXECUTABLE_BLOCK_TYPES } from '@/lib/blocks/catalog'
import { runPipeline } from '@/lib/api/pipeline'
import type { CanvasNode, Diagnostics, Metrics } from '@/types'
import { Download, Loader2, Play } from 'lucide-react'

type Tab = 'data' | 'params' | 'eval'

const TABS: { id: Tab; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'params', label: 'Params' },
  { id: 'eval', label: 'Eval' },
]

function looksLikeUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export function Inspector() {
  const [tab, setTab] = useState<Tab>('data')
  const { nodes, edges, selectedNodeId, updateParam, applyRunResults, setStatuses, isRunning, setIsRunning } =
    useCanvasStore()
  const node = nodes.find((n) => n.id === selectedNodeId)
  const router = useRouter()
  const params = useParams()
  const pageProjectId = (params?.id as string) ?? null

  useEffect(() => {
    if (selectedNodeId) setTab('params')
  }, [selectedNodeId])

  const handleEvaluate = useCallback(async () => {
    if (!node) return
    if (!EXECUTABLE_BLOCK_TYPES.has(node.data.blockType)) return

    setIsRunning(true)
    setStatuses({ [node.id]: 'running' })
    try {
      const res = await runPipeline(
        { nodes, edges },
        {
          projectId: pageProjectId && looksLikeUuid(pageProjectId) ? pageProjectId : null,
          runTo: node.id,
          persist: false,
        }
      )
      applyRunResults(res.node_results)
      setStatuses(res.statuses)
      setTab('data')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Evaluate failed'
      applyRunResults({
        [node.id]: { node_id: node.id, status: 'error', error: msg },
      })
      setStatuses({ [node.id]: 'error' })
    } finally {
      setIsRunning(false)
    }
  }, [node, nodes, edges, pageProjectId, applyRunResults, setStatuses, setIsRunning])

  // silence unused lint for router if not used yet
  void router

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
            onEvaluate={handleEvaluate}
            isRunning={isRunning}
          />
        ) : (
          <EvalTab node={node} />
        )}
      </div>
    </div>
  )
}

// ─── Data tab ────────────────────────────────────────────────────────────────

function DataTab({ node }: { node: CanvasNode }) {
  const q = node.data.quality
  const err = node.data.fetchError
  const preview = node.data.lastResult?.df_preview
  const isRunning = node.data.status === 'running'

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] font-medium text-eq-t1 truncate">{node.data.name}</div>
        {preview && preview.rows.length > 0 && (
          <button
            type="button"
            onClick={() => downloadPreviewAsCsv(preview, node.data.name || 'data')}
            title="Download preview as CSV"
            className="flex items-center gap-1 text-[9px] font-mono text-eq-cyan hover:text-eq-t1 border border-eq-cyan/30 hover:border-eq-cyan bg-eq-cyan-dim/50 rounded px-1.5 py-0.5 transition-colors flex-shrink-0"
          >
            <Download size={10} /> CSV
          </button>
        )}
      </div>

      {isRunning && (
        <div className="flex items-center gap-1.5 text-[10px] text-eq-cyan py-2">
          <Loader2 size={11} className="animate-spin" /> Running…
        </div>
      )}

      {err && !isRunning && (
        <div className="text-[10px] text-eq-red bg-eq-red-dim border border-eq-red/25 rounded px-2 py-1.5 mb-2 font-mono break-words">
          {err}
        </div>
      )}

      {q && (
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
      )}

      {preview && (
        <div className="mt-3">
          <div className="text-[9px] font-mono uppercase tracking-wider text-eq-t3 mb-1">
            Preview · {preview.shape[0]}×{preview.shape[1]}
          </div>
          <div className="max-h-48 overflow-auto border border-eq-border rounded">
            <table className="w-full text-[9px] font-mono">
              <thead className="sticky top-0 bg-bg-2">
                <tr>
                  {preview.columns.map((c) => (
                    <th key={c} className="px-1 py-0.5 text-eq-t3 text-left border-b border-eq-border whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-b border-eq-border/60">
                    {row.map((v, j) => (
                      <td key={j} className="px-1 py-0.5 text-eq-t2 whitespace-nowrap">
                        {formatPreviewCell(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!q && !preview && !isRunning && !err && (
        <p className="text-[10px] text-eq-t3 mt-2">
          No data yet. Click <span className="text-eq-accent">Evaluate</span> in Params to fetch.
        </p>
      )}
    </div>
  )
}

// ─── Params tab ──────────────────────────────────────────────────────────────

function ParamsTab({
  node,
  updateParam,
  onEvaluate,
  isRunning,
}: {
  node: CanvasNode
  updateParam: (id: string, key: string, value: string | number | boolean) => void
  onEvaluate: () => void | Promise<void>
  isRunning: boolean
}) {
  const def = CATALOG_BY_TYPE[node.data.blockType]
  const isExecutable = EXECUTABLE_BLOCK_TYPES.has(node.data.blockType)

  if (!def) return <p className="text-[10px] text-eq-t3">Unknown block type</p>

  return (
    <div className="flex flex-col gap-2">
      {def.stretch && (
        <div className="text-[10px] text-eq-amber bg-eq-amber-dim border border-eq-amber/25 rounded px-2 py-1.5 font-mono">
          Stretch block — no backend executor. Evaluate / Run will skip it.
        </div>
      )}
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

      {isExecutable && (
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

// ─── Eval tab ────────────────────────────────────────────────────────────────

function EvalTab({ node }: { node: CanvasNode }) {
  const bt = node.data.blockType
  if (bt === 'signal_diagnostics' && node.data.diagnostics) {
    return <DiagnosticsCards d={node.data.diagnostics} />
  }
  if (bt === 'backtest' && node.data.metrics) {
    return <BacktestCards m={node.data.metrics} />
  }
  return (
    <p className="text-[9px] text-eq-t3 text-center mt-4">
      Evaluate or Run this node to populate metrics.
    </p>
  )
}

function BacktestCards({ m }: { m: Metrics }) {
  const sharpe = m.sharpe ?? 0
  const dd = m.maxDrawdown ?? m.max_drawdown ?? 0
  const tr = m.totalReturn ?? m.total_return ?? 0
  const hit = m.winRate ?? m.hit_rate ?? 0
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {[
        { label: 'Sharpe', value: sharpe.toFixed(2), pos: sharpe > 0 },
        { label: 'Max DD', value: `${(dd * 100).toFixed(1)}%`, pos: false },
        { label: 'Total Ret', value: `${(tr * 100).toFixed(1)}%`, pos: tr > 0 },
        { label: 'Hit Rate', value: `${(hit * 100).toFixed(1)}%`, pos: hit > 0.5 },
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
      {m.n_trades !== undefined && (
        <div className="col-span-2 text-[9px] font-mono text-eq-t3">
          {m.n_trades} trades · avg hold {m.avg_holding_period?.toFixed(1) ?? '?'} bars
        </div>
      )}
    </div>
  )
}

function DiagnosticsCards({ d }: { d: Diagnostics }) {
  const icColor =
    d.ic > 0.02 ? 'text-eq-green' : d.ic >= 0 ? 'text-eq-amber' : 'text-eq-red'

  const horizons = Object.keys(d.ic_decay)
    .map((k) => [Number(k), d.ic_decay[k]] as [number, number])
    .sort((a, b) => a[0] - b[0])
  const decayMax = Math.max(0.01, ...horizons.map(([, v]) => Math.abs(v || 0)))

  const months = Object.entries(d.ic_stability)
    .sort(([a], [b]) => a.localeCompare(b))
  const monthMax = Math.max(0.01, ...months.map(([, v]) => Math.abs(v || 0)))

  return (
    <div className="flex flex-col gap-2.5">
      {/* IC value */}
      <div className="bg-bg-2 border border-eq-border rounded p-2">
        <div className="text-[8px] text-eq-t3 uppercase tracking-wider mb-0.5">IC · n={d.n}</div>
        <div className={`text-[22px] font-light font-mono ${icColor}`}>
          {Number.isFinite(d.ic) ? d.ic.toFixed(3) : '—'}
        </div>
        <div className="text-[9px] text-eq-t3 font-mono">
          t-stat {Number.isFinite(d.ic_tstat) ? d.ic_tstat.toFixed(2) : '—'}
        </div>
      </div>

      {/* IC Decay bars */}
      {horizons.length > 0 && (
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-eq-t3 mb-1">
            IC Decay
          </div>
          <div className="flex items-end gap-1 h-14 bg-bg-2 border border-eq-border rounded p-1">
            {horizons.map(([h, v]) => {
              const mag = Math.abs(v || 0) / decayMax
              const color = v >= 0 ? 'bg-eq-green' : 'bg-eq-red'
              return (
                <div key={h} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className={`w-full rounded-sm ${color}`}
                    style={{ height: `${Math.max(2, mag * 42)}px` }}
                    title={`h=${h}: ${v?.toFixed(3) ?? 'NaN'}`}
                  />
                  <div className="text-[7px] text-eq-t3 font-mono mt-0.5">{h}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stability heatmap */}
      {months.length > 0 && (
        <div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-eq-t3 mb-1">
            IC Stability ({months.length} mo)
          </div>
          <div className="flex flex-wrap gap-0.5 bg-bg-2 border border-eq-border rounded p-1">
            {months.map(([ym, v]) => {
              const mag = Math.min(1, Math.abs(v || 0) / monthMax)
              const hue = v >= 0 ? '140' : '0'
              return (
                <div
                  key={ym}
                  title={`${ym}: ${v?.toFixed(3) ?? 'NaN'}`}
                  className="w-3 h-3 rounded-sm"
                  style={{ background: `hsl(${hue}, 60%, ${20 + mag * 40}%)` }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Autocorr */}
      <div className="flex items-center justify-between py-1 border-t border-eq-border">
        <span className="text-[10px] text-eq-t2">Autocorr</span>
        <span className="text-[10px] font-mono text-eq-t1">
          {Number.isFinite(d.signal_autocorr) ? d.signal_autocorr.toFixed(3) : '—'}
        </span>
      </div>
    </div>
  )
}

// ─── CSV helper ──────────────────────────────────────────────────────────────

function formatPreviewCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4)
  const s = String(v)
  return s.length > 24 ? s.slice(0, 22) + '…' : s
}

function downloadPreviewAsCsv(
  preview: { columns: string[]; rows: unknown[][] },
  baseName: string
) {
  const lines = [
    preview.columns.join(','),
    ...preview.rows.map((r) =>
      r
        .map((v) =>
          v === null || v === undefined
            ? ''
            : typeof v === 'string' && v.includes(',')
            ? `"${v.replace(/"/g, '""')}"`
            : String(v)
        )
        .join(',')
    ),
  ]
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitize(baseName)}_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40) || 'export'
}
