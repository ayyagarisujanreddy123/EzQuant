'use client'
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { CanvasNode, NodeRunResult, BlockStatus } from '@/types'

interface ConsoleEntry {
  id: string
  ts: string
  level: 'ok' | 'warn' | 'err' | 'info'
  msg: string
}

const MAX_CONSOLE_ENTRIES = 200

const LEVEL_CLASS: Record<ConsoleEntry['level'], string> = {
  ok: 'text-eq-green',
  warn: 'text-eq-amber',
  err: 'text-eq-red',
  info: 'text-eq-blue',
}

function fmtTime(d: Date): string {
  return d.toTimeString().slice(0, 8)
}

function fmtElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function nodeLabel(node: CanvasNode): string {
  const name = (node.data.name || '').trim()
  const type = node.data.blockType
  return name && name !== type ? `${type} "${name}"` : type
}

// ─── Registry descriptor helpers ─────────────────────────────────────────────

const OHLCV_COLS = ['Open', 'High', 'Low', 'Close', 'Volume']

function abbreviateColumn(col: string): string {
  if (col === 'log_return') return 'LR'
  if (col.startsWith('forward_return_')) return `FR${col.replace('forward_return_', '')}`
  if (col.startsWith('ema_')) return `EMA${col.replace('ema_', '')}`
  if (col.startsWith('momentum_')) return `MOM${col.replace('momentum_', '')}`
  if (col === 'signal') return 'SIG'
  if (col === 'position') return 'POS'
  if (col === 'position_change') return 'ΔPOS'
  if (col === 'pnl') return 'PNL'
  if (col === 'equity') return 'EQ'
  if (col === 'adj_close') return 'ADJ'
  if (col === 'ic') return 'IC'
  if (col === 'n_tickers') return 'N'
  return col.toUpperCase().slice(0, 5)
}

function describeColumns(cols: string[]): { abbrev: string; full: string } {
  // Strip date/index + de-dup, preserve order.
  const skip = new Set(['index', 'timestamp', 'Date'])
  const clean = cols.filter((c) => !skip.has(c))

  const ohlcvPresent = OHLCV_COLS.filter((c) => clean.includes(c))
  const hasOhlcv = ohlcvPresent.length >= 4
  const rest = hasOhlcv
    ? clean.filter((c) => !OHLCV_COLS.includes(c))
    : clean

  const tokens: string[] = []
  if (hasOhlcv) tokens.push('OHLCV')
  for (const c of rest) tokens.push(abbreviateColumn(c))

  return {
    abbrev: tokens.length > 0 ? tokens.join('_') : 'df',
    full: clean.join(', '),
  }
}

function primaryTickerForNode(node: CanvasNode): string | null {
  const perTicker = node.data.lastResult?.per_ticker
  if (perTicker) {
    const keys = Object.keys(perTicker)
    if (keys.length > 0) return keys[0]
  }
  // Universe stores ticker in params.symbol (may be CSV).
  if (node.data.blockType === 'universe') {
    const raw = String(node.data.params?.symbol ?? '').split(',')[0].trim().toUpperCase()
    if (raw) return raw
  }
  const meta = node.data.lastResult?.metadata as Record<string, unknown> | undefined
  if (meta && typeof meta.symbol === 'string') return meta.symbol as string
  return null
}

function buildRegistryEntries(nodes: CanvasNode[]): RegistryEntry[] {
  const out: RegistryEntry[] = []
  for (const n of nodes) {
    const result = n.data.lastResult
    const baseId = n.data.id || n.id

    // Special case: signal_diagnostics is cross-sectional — one entry only.
    if (n.data.blockType === 'signal_diagnostics') {
      const cols = result?.df_preview?.columns ?? []
      const shape = result?.shape
      out.push({
        nodeId: baseId,
        ticker: null,
        name: `CS-IC_${baseId}${cols.length ? '_' + describeColumns(cols).abbrev : ''}`,
        shape: shape ? `(${shape[0]}, ${shape[1]})` : null,
        status: n.data.status,
        hoverCols: result?.df_preview?.columns.join(', ') ?? '',
      })
      continue
    }

    // Multi-ticker: one row per (node, ticker).
    const perTicker = result?.per_ticker
    if (perTicker && Object.keys(perTicker).length > 0) {
      for (const [ticker, sub] of Object.entries(perTicker) as [string, NodeRunResult][]) {
        const desc = describeColumns(sub.df_preview?.columns ?? [])
        const shape = sub.shape
        out.push({
          nodeId: baseId,
          ticker,
          name: `${ticker}_${desc.abbrev}`,
          shape: shape ? `(${shape[0]}, ${shape[1]})` : null,
          status: sub.status ?? n.data.status,
          hoverCols: desc.full,
        })
      }
      continue
    }

    // Single-ticker: one row total.
    const cols = result?.df_preview?.columns ?? []
    const desc = describeColumns(cols)
    const ticker = primaryTickerForNode(n)
    const shape = result?.shape
    const name = ticker ? `${ticker}_${desc.abbrev}` : `${baseId}_${desc.abbrev}`
    out.push({
      nodeId: baseId,
      ticker,
      name,
      shape: shape ? `(${shape[0]}, ${shape[1]})` : null,
      status: n.data.status,
      hoverCols: desc.full,
    })
  }
  return out
}

// ─── Resize constants ───────────────────────────────────────────────────────

const MIN_HEIGHT = 80
const MAX_HEIGHT = 480
const HEADER_HEIGHT = 28
const MIN_SPLIT = 0.15
const MAX_SPLIT = 0.85

interface RegistryEntry {
  nodeId: string
  ticker: string | null
  name: string
  shape: string | null
  status: 'idle' | 'running' | 'success' | 'error' | 'skipped'
  hoverCols: string
}

export function BottomDrawer() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerHeight, setDrawerHeight] = useState(140)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const { nodes } = useCanvasStore()

  const entries = useMemo<RegistryEntry[]>(() => buildRegistryEntries(nodes), [nodes])

  // ── Console log driven by node-status transitions ─────────────────────────
  //
  // We keep a per-node snapshot of (status, startTime, errorMsg) so each render
  // can diff against the current nodes and emit at most one console line per
  // transition (running → success/error). Timing is measured client-side from
  // the moment status flips to 'running'.
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([])
  const prevStatusRef = useRef<Map<string, BlockStatus>>(new Map())
  const startedAtRef = useRef<Map<string, number>>(new Map())
  const consoleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = prevStatusRef.current
    const starts = startedAtRef.current
    const additions: ConsoleEntry[] = []
    const now = () => new Date()
    const currentIds = new Set<string>()

    for (const node of nodes) {
      const id = node.id
      currentIds.add(id)
      const status = node.data.status
      const before = prev.get(id)
      if (before === status) continue

      if (status === 'running') {
        starts.set(id, performance.now())
      } else if (status === 'success' || status === 'error' || status === 'skipped') {
        const startedAt = starts.get(id)
        const elapsedMs = startedAt != null ? performance.now() - startedAt : NaN
        starts.delete(id)
        const label = nodeLabel(node)
        const ts = fmtTime(now())
        if (status === 'success') {
          additions.push({
            id: `${id}:${ts}:ok`,
            ts,
            level: 'ok',
            msg: `✓ completed block ${label} — time: ${fmtElapsed(elapsedMs)}`,
          })
        } else if (status === 'error') {
          const d = node.data as {
            fetchError?: string
            lastError?: string
            error?: string
            lastResult?: { error?: string }
          }
          const err =
            d.fetchError ??
            d.lastError ??
            d.error ??
            d.lastResult?.error ??
            'unknown error'
          additions.push({
            id: `${id}:${ts}:err`,
            ts,
            level: 'err',
            msg: `✗ block ${label} failed — time: ${fmtElapsed(elapsedMs)} · ${err}`,
          })
        } else {
          additions.push({
            id: `${id}:${ts}:skip`,
            ts,
            level: 'warn',
            msg: `⤼ block ${label} skipped — upstream failure`,
          })
        }
      }

      prev.set(id, status)
    }

    // Forget state for deleted nodes so a recreated id doesn't replay stale transitions.
    for (const id of Array.from(prev.keys())) {
      if (!currentIds.has(id)) {
        prev.delete(id)
        starts.delete(id)
      }
    }

    if (additions.length) {
      setConsoleEntries((list) => {
        const next = list.concat(additions)
        if (next.length <= MAX_CONSOLE_ENTRIES) return next
        return next.slice(next.length - MAX_CONSOLE_ENTRIES)
      })
    }
  }, [nodes])

  // Autoscroll console to the newest line.
  useEffect(() => {
    consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight })
  }, [consoleEntries.length])

  const clearConsole = useCallback(() => setConsoleEntries([]), [])

  const drawerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Vertical (height) drag
  const onVerticalDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = drawerHeight
    const handler = (ev: PointerEvent) => {
      const dy = startY - ev.clientY
      const next = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + dy))
      setDrawerHeight(next)
      if (collapsed) setCollapsed(false)
    }
    const stop = () => {
      window.removeEventListener('pointermove', handler)
      window.removeEventListener('pointerup', stop)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', handler)
    window.addEventListener('pointerup', stop)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [drawerHeight, collapsed])

  // Horizontal (split) drag
  const onHorizontalDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const bodyEl = bodyRef.current
    if (!bodyEl) return
    const rect = bodyEl.getBoundingClientRect()
    const handler = (ev: PointerEvent) => {
      const x = ev.clientX - rect.left
      const ratio = Math.max(MIN_SPLIT, Math.min(MAX_SPLIT, x / rect.width))
      setSplitRatio(ratio)
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
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const effectiveHeight = collapsed ? HEADER_HEIGHT : drawerHeight

  return (
    <div
      ref={drawerRef}
      className="bg-bg-1 border-t border-eq-border flex-shrink-0 relative"
      style={{ height: `${effectiveHeight}px` }}
    >
      {/* Vertical resize handle — thin strip at top */}
      <div
        onPointerDown={onVerticalDragStart}
        onDoubleClick={() => setDrawerHeight(140)}
        className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-eq-accent/40 transition-colors z-10"
        title="Drag to resize · double-click to reset"
      />

      <div className="flex items-center h-7 px-3 border-b border-eq-border">
        <span className="text-[10px] font-medium text-eq-t3 uppercase tracking-wider">
          Registry &amp; Console
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-auto text-eq-t3 hover:text-eq-t1"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {!collapsed && (
        <div
          ref={bodyRef}
          className="flex overflow-hidden"
          style={{ height: `${drawerHeight - HEADER_HEIGHT}px` }}
        >
          {/* Registry pane */}
          <div
            className="p-2 overflow-y-auto"
            style={{ width: `${splitRatio * 100}%` }}
          >
            <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="text-eq-blue">▣</span> Registry
            </div>
            {entries.length === 0 ? (
              <div className="text-[9px] text-eq-t3 italic py-1">
                (no nodes yet — drop blocks on the canvas)
              </div>
            ) : (
              entries.map((e, i) => (
                <div
                  key={`${e.nodeId}:${e.ticker ?? ''}:${i}`}
                  className="flex items-center gap-2 py-0.5 border-b border-eq-border text-[10px] font-mono"
                  title={e.hoverCols}
                >
                  <span
                    className={`flex-1 truncate ${
                      e.status === 'success'
                        ? 'text-eq-blue'
                        : e.status === 'error'
                        ? 'text-eq-red'
                        : e.status === 'running'
                        ? 'text-eq-cyan'
                        : 'text-eq-t3'
                    }`}
                  >
                    {e.name}
                  </span>
                  <span className="text-eq-t3 text-[9px] flex-shrink-0">
                    {e.shape ?? (e.status === 'success' ? '—' : 'pending')}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Horizontal resize handle */}
          <div
            onPointerDown={onHorizontalDragStart}
            onDoubleClick={() => setSplitRatio(0.5)}
            className="w-1 cursor-ew-resize bg-eq-border hover:bg-eq-accent/40 transition-colors flex-shrink-0"
            title="Drag to resize · double-click to reset"
          />

          {/* Console pane */}
          <div ref={consoleRef} className="flex-1 p-2 overflow-y-auto">
            <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="text-eq-accent">›_</span> Console
              {consoleEntries.length > 0 && (
                <>
                  <span className="ml-1 text-eq-t3 normal-case tracking-normal">
                    · {consoleEntries.length}
                  </span>
                  <button
                    type="button"
                    onClick={clearConsole}
                    className="ml-auto text-eq-t3 hover:text-eq-t1 text-[9px] normal-case tracking-normal"
                    title="Clear console"
                  >
                    clear
                  </button>
                </>
              )}
            </div>
            {consoleEntries.length === 0 ? (
              <div className="text-[9px] text-eq-t3 italic py-1">
                (no block runs yet — hit Run or Evaluate)
              </div>
            ) : (
              consoleEntries.map((line) => (
                <div key={line.id} className="flex gap-2 text-[10px] font-mono py-px">
                  <span className="text-eq-t3 flex-shrink-0">{line.ts}</span>
                  <span className={LEVEL_CLASS[line.level]}>{line.msg}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
