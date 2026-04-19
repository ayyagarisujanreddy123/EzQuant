'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
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

/**
 * Dev-time sanity check + payload dump. Logs:
 *   1. shape (full rows × cols on the backend) vs preview.rows.length (what
 *      actually shipped to the frontend) — diff = truncation
 *   2. first / last timestamp across the FULL backend df (read from shape + the
 *      preview's boundary rows)
 *   3. the raw df_preview payload so you can poke at it in devtools
 *
 * Why the frontend only sees ~50 rows for a 2-year request: backend
 * `PREVIEW_MAX_ROWS = 50` in `backend/services/pipeline_runner.py`. The
 * full DataFrame IS computed server-side — it's just not serialized.
 */
function logEvaluateTimestamps(
  evaluatedNode: CanvasNode,
  results: Record<string, NonNullable<CanvasNode['data']['lastResult']>>
) {
  // Focused log for the node that was just Evaluated.
  const mine = results[evaluatedNode.id]
  // eslint-disable-next-line no-console
  console.group(
    `[evaluate] ${evaluatedNode.data.blockType} "${evaluatedNode.data.name}"`
  )

  if (mine?.df_preview && mine.df_preview.rows.length > 0) {
    const firstTs = String(mine.df_preview.rows[0][0] ?? '')
    const lastTs = String(
      mine.df_preview.rows[mine.df_preview.rows.length - 1][0] ?? ''
    )
    const totalRows = mine.shape?.[0] ?? mine.df_preview.rows.length
    const previewRows = mine.df_preview.rows.length
    const truncated = totalRows > previewRows
    const spanDays = Math.round(
      (new Date(lastTs).getTime() - new Date(firstTs).getTime()) / 86_400_000
    )

    // eslint-disable-next-line no-console
    console.log(
      `first=${firstTs}  last=${lastTs}  backend_rows=${totalRows}  ` +
        `preview_rows=${previewRows}  preview_span=${spanDays}d`
    )
    if (truncated) {
      // eslint-disable-next-line no-console
      console.warn(
        `⚠ TRUNCATION: backend has ${totalRows} rows but only ${previewRows} ` +
          `shipped. First/last timestamps above are from the PREVIEW window, ` +
          `NOT the full backend DataFrame. Cap lives in ` +
          `backend/services/pipeline_runner.py → PREVIEW_MAX_ROWS.`
      )
    }
    // Dump the full preview for inspection.
    // eslint-disable-next-line no-console
    console.log('df_preview:', mine.df_preview)
  } else {
    // eslint-disable-next-line no-console
    console.log('no df_preview (status:', mine?.status, ')')
  }

  // Table across all executed nodes.
  const rows: Array<Record<string, unknown>> = []
  for (const [id, r] of Object.entries(results)) {
    if (!r.df_preview || r.df_preview.rows.length === 0) {
      rows.push({ node_id: id, status: r.status, backend_rows: r.shape?.[0] ?? 0 })
      continue
    }
    const first = String(r.df_preview.rows[0][0] ?? '')
    const last = String(r.df_preview.rows[r.df_preview.rows.length - 1][0] ?? '')
    rows.push({
      node_id: id,
      status: r.status,
      first_ts: first,
      last_ts: last,
      backend_rows: r.shape?.[0] ?? 0,
      preview_rows: r.df_preview.rows.length,
      truncated: (r.shape?.[0] ?? 0) > r.df_preview.rows.length,
    })
  }
  if (rows.length > 0 && typeof console.table === 'function') {
    // eslint-disable-next-line no-console
    console.table(rows)
  }

  // eslint-disable-next-line no-console
  console.groupEnd()
}

// Params whose string value is a DataFrame column name. Promoted to dropdown
// when upstream columns are known.
const COLUMN_PARAM_KEYS = new Set<string>([
  'column',
  'return_column',
  'other_col',
  'price_col',
  'date_col',
  'date_column',
  'target_col',
  'source_column',
  'forward_return_column',
])

/** Walk edges upstream from nodeId, union columns from the closest ancestor
 * that has a successful df_preview. Returns [] if nothing has run yet. */
function useUpstreamColumns(nodeId: string | null): string[] {
  const { nodes, edges } = useCanvasStore()
  return useMemo(() => {
    if (!nodeId) return []
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const parentsOf: Record<string, string[]> = {}
    for (const e of edges) {
      if (!parentsOf[e.target]) parentsOf[e.target] = []
      parentsOf[e.target].push(e.source)
    }
    // BFS upward; collect the first layer of ancestors that actually have cols.
    const cols = new Set<string>()
    const visited = new Set<string>([nodeId])
    const queue: string[] = [...(parentsOf[nodeId] ?? [])]
    while (queue.length) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      const n = byId.get(id)
      const preview = n?.data.lastResult?.df_preview
      if (preview) {
        for (const c of preview.columns) {
          if (!['index', 'timestamp', 'Date'].includes(c)) cols.add(c)
        }
        // Don't recurse past a node that already produced columns —
        // closest-ancestor wins for clarity.
        continue
      }
      queue.push(...(parentsOf[id] ?? []))
    }
    return [...cols]
  }, [nodeId, nodes, edges])
}

const INSPECTOR_MIN = 200
const INSPECTOR_MAX = 700
const INSPECTOR_DEFAULT = 260

export function Inspector() {
  const [tab, setTab] = useState<Tab>('data')
  const [width, setWidth] = useState<number>(INSPECTOR_DEFAULT)
  const { nodes, edges, selectedNodeId, updateParam, applyRunResults, setStatuses, isRunning, setIsRunning } =
    useCanvasStore()
  const node = nodes.find((n) => n.id === selectedNodeId)
  const router = useRouter()
  const params = useParams()
  const pageProjectId = (params?.id as string) ?? null

  useEffect(() => {
    if (selectedNodeId) setTab('params')
  }, [selectedNodeId])

  const onResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const handler = (ev: PointerEvent) => {
      // Dragging LEFT widens the panel (the handle is on its left edge).
      const dx = startX - ev.clientX
      const next = Math.max(INSPECTOR_MIN, Math.min(INSPECTOR_MAX, startW + dx))
      setWidth(next)
    }
    const stop = () => {
      window.removeEventListener('pointermove', handler)
      window.removeEventListener('pointerup', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', handler)
    window.addEventListener('pointerup', stop)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [width])

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
      logEvaluateTimestamps(node, res.node_results)
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
    <div
      className="bg-bg-1 border-l border-eq-border flex-shrink-0 overflow-y-auto relative"
      style={{ width: `${width}px` }}
    >
      {/* Drag handle — left edge, widens panel when dragged leftward */}
      <div
        onPointerDown={onResizeStart}
        onDoubleClick={() => setWidth(INSPECTOR_DEFAULT)}
        className="absolute top-0 left-0 w-1 h-full cursor-ew-resize hover:bg-eq-accent/40 transition-colors z-20"
        title="Drag to resize · double-click to reset"
      />
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

  // Numeric columns in preview (skip date/index) — candidates for the chart.
  const numericCols = useMemo(() => {
    if (!preview) return []
    return preview.columns.filter((c, i) => {
      if (['index', 'timestamp', 'Date'].includes(c)) return false
      return preview.rows.some((r) => typeof r[i] === 'number' && !Number.isNaN(r[i]))
    })
  }, [preview])

  const defaultCol = useMemo(() => pickDefaultPlotColumn(numericCols, node.data.blockType), [numericCols, node.data.blockType])
  const [selectedCol, setSelectedCol] = useState<string>(defaultCol)

  // Reset selection when preview changes (e.g. re-Evaluate brings new columns).
  useEffect(() => {
    if (defaultCol && !numericCols.includes(selectedCol)) {
      setSelectedCol(defaultCol)
    }
  }, [defaultCol, numericCols, selectedCol])

  const seriesPairs = useMemo(() => {
    if (!preview || !selectedCol) return [] as { t: string; v: number }[]
    const colIdx = preview.columns.indexOf(selectedCol)
    const dateIdx = 0 // index column is always first
    if (colIdx < 0) return []
    const out: { t: string; v: number }[] = []
    for (const row of preview.rows) {
      const v = row[colIdx]
      if (typeof v !== 'number' || Number.isNaN(v)) continue
      out.push({ t: String(row[dateIdx] ?? ''), v })
    }
    return out
  }, [preview, selectedCol])

  const series = useMemo(() => seriesPairs.map((p) => p.v), [seriesPairs])

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
        </>
      )}

      {/* Column-picker + enhanced chart */}
      {numericCols.length > 0 ? (
        <div className="mt-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <label className="text-[9px] text-eq-t3 uppercase tracking-wider">Chart</label>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              className="flex-1 bg-bg-3 border border-eq-border text-eq-t1 text-[10px] rounded px-1.5 py-1 font-mono outline-none"
            >
              {numericCols.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {seriesPairs.length > 1 ? (
            <EnhancedChart
              pairs={seriesPairs}
              stroke={pickStroke(selectedCol)}
              label={selectedCol}
            />
          ) : (
            <p className="text-[9px] text-eq-t3">Not enough data to chart.</p>
          )}
        </div>
      ) : q?.sparkline && q.sparkline.length > 1 ? (
        <div className="mt-2 h-9 bg-bg-2 border border-eq-border rounded p-0.5">
          <svg width="100%" height="28" viewBox="0 0 100 28" preserveAspectRatio="none">
            <polyline
              points={q.sparkline
                .map((v, i) => `${(i / (q.sparkline!.length - 1)) * 100},${(1 - v) * 24 + 2}`)
                .join(' ')}
              fill="none"
              stroke="#2dd4a0"
              strokeWidth="1.3"
            />
          </svg>
        </div>
      ) : null}

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
  const upstreamCols = useUpstreamColumns(node.id)

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
        // Promote column-referring string params to a dropdown when upstream
        // columns are known from the last Evaluate/Run.
        const isColumnRef = COLUMN_PARAM_KEYS.has(schema.key) && schema.type === 'string'
        const showColumnSelect = isColumnRef && upstreamCols.length > 0

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
            ) : showColumnSelect ? (
              <select
                value={String(current)}
                onChange={(e) => updateParam(node.id, schema.key, e.target.value)}
                className="w-full mt-0.5 bg-bg-3 border border-eq-border text-eq-t1 text-[10px] rounded px-1.5 py-1 font-mono outline-none"
              >
                {/* Allow the current value even if it isn't in the current upstream set. */}
                {!upstreamCols.includes(String(current)) && current !== '' && (
                  <option value={String(current)}>{String(current)} (custom)</option>
                )}
                {upstreamCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
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
            {isColumnRef && upstreamCols.length === 0 && (
              <p className="text-[8px] text-eq-t3 mt-0.5 font-mono">
                Run upstream to see available columns.
              </p>
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
  const preview = node.data.lastResult?.df_preview
  if (preview) {
    return <OutputStats preview={preview} blockType={bt} />
  }
  return (
    <div className="text-[10px] text-eq-t3 mt-2 leading-relaxed">
      <p className="mb-2">
        No metrics yet.
      </p>
      <p className="text-eq-t3/80">
        Eval tab is most useful on <span className="text-eq-cyan">Signal Diagnostics</span> (IC)
        and <span className="text-eq-green">Backtest</span> (Sharpe).
        For this block, check the <span className="text-eq-t1">Data</span> tab after running.
      </p>
    </div>
  )
}

function OutputStats({
  preview,
  blockType,
}: {
  preview: { columns: string[]; rows: unknown[][] }
  blockType: string
}) {
  // Hunt for the most interesting output column for this block type.
  const priorityCol = pickInterestingColumn(preview.columns, blockType)
  const colIdx = preview.columns.indexOf(priorityCol ?? '')
  const series: number[] =
    colIdx >= 0
      ? (preview.rows
          .map((r) => r[colIdx])
          .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v)) as number[])
      : []

  if (series.length === 0) {
    return (
      <p className="text-[10px] text-eq-t3 mt-2">
        {preview.rows.length} rows produced. Check the Data tab for the preview.
      </p>
    )
  }

  const mean = series.reduce((a, b) => a + b, 0) / series.length
  const variance = series.reduce((a, b) => a + (b - mean) ** 2, 0) / series.length
  const std = Math.sqrt(variance)
  const min = Math.min(...series)
  const max = Math.max(...series)

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[9px] font-mono uppercase tracking-wider text-eq-t3">
        Output · <span className="text-eq-t1">{priorityCol}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          ['Mean', mean.toFixed(4)],
          ['Std', std.toFixed(4)],
          ['Min', min.toFixed(4)],
          ['Max', max.toFixed(4)],
        ].map(([label, value]) => (
          <div key={label} className="bg-bg-2 border border-eq-border rounded p-1.5">
            <div className="text-[8px] text-eq-t3 uppercase tracking-wider mb-0.5">{label}</div>
            <div className="text-[12px] font-light font-mono text-eq-t1">{value}</div>
          </div>
        ))}
      </div>
      <div className="text-[9px] font-mono text-eq-t3 text-right">
        n = {series.length}
      </div>
    </div>
  )
}

function pickInterestingColumn(columns: string[], blockType: string): string | null {
  // Prefer the column this block just added.
  const wants: Record<string, (c: string) => boolean> = {
    log_returns: (c) => c === 'log_return',
    forward_return: (c) => c.startsWith('forward_return_'),
    ema: (c) => c.startsWith('ema_'),
    momentum: (c) => c.startsWith('momentum_'),
    signal: (c) => c === 'signal',
    position_sizer: (c) => c === 'position',
  }
  const pred = wants[blockType]
  if (pred) {
    const hit = columns.find(pred)
    if (hit) return hit
  }
  // Fallback: last numeric-looking column (skip index/timestamp).
  for (let i = columns.length - 1; i >= 0; i--) {
    const c = columns[i]
    if (c !== 'index' && c !== 'timestamp' && c !== 'Date') return c
  }
  return columns[columns.length - 1] ?? null
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

interface ChartPair { t: string; v: number }

function EnhancedChart({
  pairs,
  stroke,
  label,
}: {
  pairs: ChartPair[]
  stroke: string
  label: string
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const vals = pairs.map((p) => p.v)
  const vMin = Math.min(...vals)
  const vMax = Math.max(...vals)
  const vRange = vMax - vMin || 1

  // Viewbox in abstract units; stretches to container width via preserveAspectRatio=none.
  const W = 320
  const H = 140
  const padL = 38
  const padR = 6
  const padT = 6
  const padB = 18
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const xFor = (i: number) => padL + (i / (pairs.length - 1)) * plotW
  const yFor = (v: number) => padT + (1 - (v - vMin) / vRange) * plotH

  const pointsPath = pairs.map((p, i) => `${xFor(i)},${yFor(p.v)}`).join(' ')
  const areaPath =
    `M ${xFor(0)},${yFor(vMin)} ` +
    pairs.map((p, i) => `L ${xFor(i)},${yFor(p.v)}`).join(' ') +
    ` L ${xFor(pairs.length - 1)},${yFor(vMin)} Z`

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => vMin + f * vRange)
  const showZeroLine = vMin < 0 && vMax > 0

  const xTicks = [0, Math.floor(pairs.length / 2), pairs.length - 1]

  const hovered = hoverIdx !== null ? pairs[hoverIdx] : null

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const rx = ((e.clientX - rect.left) / rect.width) * W
    if (rx < padL || rx > W - padR) {
      setHoverIdx(null)
      return
    }
    const frac = (rx - padL) / plotW
    const i = Math.max(0, Math.min(pairs.length - 1, Math.round(frac * (pairs.length - 1))))
    setHoverIdx(i)
  }

  return (
    <div className="bg-bg-2 border border-eq-border rounded-md p-1.5 relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-40 block cursor-crosshair"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverIdx(null)}
      >
        {/* Gridlines */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line
              x1={padL} x2={W - padR}
              y1={yFor(v)} y2={yFor(v)}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.6"
              strokeDasharray={i === 0 || i === gridVals.length - 1 ? '' : '2 3'}
            />
            <text
              x={padL - 4} y={yFor(v) + 3}
              textAnchor="end"
              fontSize="8.5"
              fontFamily="var(--font-mono)"
              fill="#555a6a"
            >
              {formatTick(v)}
            </text>
          </g>
        ))}

        {/* Zero line (if crosses) */}
        {showZeroLine && (
          <line
            x1={padL} x2={W - padR}
            y1={yFor(0)} y2={yFor(0)}
            stroke="#8b909e"
            strokeWidth="0.6"
            strokeDasharray="3 2"
          />
        )}

        {/* Area fill */}
        <path d={areaPath} fill={stroke} opacity="0.08" />

        {/* Line */}
        <polyline
          points={pointsPath}
          fill="none"
          stroke={stroke}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X-axis ticks */}
        {xTicks.map((i) => (
          <text
            key={i}
            x={xFor(i)} y={H - 5}
            textAnchor={i === 0 ? 'start' : i === pairs.length - 1 ? 'end' : 'middle'}
            fontSize="8.5"
            fontFamily="var(--font-mono)"
            fill="#555a6a"
          >
            {formatDateTick(pairs[i]?.t)}
          </text>
        ))}

        {/* Hover crosshair + dot */}
        {hovered && hoverIdx !== null && (
          <g>
            <line
              x1={xFor(hoverIdx)} x2={xFor(hoverIdx)}
              y1={padT} y2={H - padB}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth="0.5"
            />
            <circle
              cx={xFor(hoverIdx)}
              cy={yFor(hovered.v)}
              r="2.5"
              fill={stroke}
              stroke="#0b0d12"
              strokeWidth="1"
            />
          </g>
        )}
      </svg>

      {/* Header strip: label + hover value */}
      <div className="flex items-center justify-between text-[9px] font-mono absolute top-2 left-3 right-3 pointer-events-none">
        <span className="text-eq-t3">{label}</span>
        {hovered ? (
          <span className="text-eq-t1 bg-bg-3 border border-eq-border-2 rounded px-1.5 py-0.5">
            {formatDateTick(hovered.t)} · {formatTick(hovered.v)}
          </span>
        ) : (
          <span className="text-eq-t3">
            n={pairs.length} · {formatTick(vMin)}→{formatTick(vMax)}
          </span>
        )}
      </div>
    </div>
  )
}

function formatTick(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs === 0) return '0'
  if (abs < 0.001) return v.toExponential(1)
  if (abs < 1) return v.toFixed(4)
  if (abs < 100) return v.toFixed(2)
  if (abs < 1e6) return v.toFixed(0)
  return (v / 1e6).toFixed(1) + 'M'
}

function formatDateTick(raw: string | undefined): string {
  if (!raw) return ''
  // Try parsing an ISO-ish timestamp. Fall back to trimmed string.
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return String(raw).slice(0, 10)
}

function pickDefaultPlotColumn(numericCols: string[], blockType: string): string {
  if (numericCols.length === 0) return ''
  // Prefer the column this block most recently produced.
  const hints: Record<string, (c: string) => boolean> = {
    universe: (c) => c === 'Close',
    log_returns: (c) => c === 'log_return',
    forward_return: (c) => c.startsWith('forward_return_'),
    ema: (c) => c.startsWith('ema_'),
    momentum: (c) => c.startsWith('momentum_'),
    signal: (c) => c === 'signal',
    position_sizer: (c) => c === 'position',
    backtest: (c) => c === 'equity',
  }
  const hint = hints[blockType]
  if (hint) {
    const hit = numericCols.find(hint)
    if (hit) return hit
  }
  // Fallbacks.
  return (
    numericCols.find((c) => c === 'Close') ??
    numericCols.find((c) => c === 'signal') ??
    numericCols[numericCols.length - 1]
  )
}

function normalizeToSparkline(series: number[]): number[] {
  if (series.length < 2) return series
  const mn = Math.min(...series)
  const mx = Math.max(...series)
  const rng = mx - mn || 1
  const target = 60
  const step = Math.max(1, Math.floor(series.length / target))
  const out: number[] = []
  for (let i = 0; i < series.length; i += step) out.push((series[i] - mn) / rng)
  if (out[out.length - 1] !== (series[series.length - 1] - mn) / rng) {
    out.push((series[series.length - 1] - mn) / rng)
  }
  return out
}

function pickStroke(col: string): string {
  if (col === 'signal') return '#8b7dff'
  if (col === 'position') return '#22d3ee'
  if (col === 'equity' || col === 'pnl') return '#2dd4a0'
  if (col.startsWith('forward_return')) return '#fbbf24'
  if (col.startsWith('ema_') || col.startsWith('momentum_')) return '#8b7dff'
  if (col === 'log_return') return '#60a5fa'
  return '#2dd4a0'
}

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
