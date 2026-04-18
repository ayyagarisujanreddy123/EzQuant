'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ConsoleEntry {
  ts: string
  level: 'ok' | 'warn' | 'err' | 'info'
  msg: string
}

const INITIAL_CONSOLE: ConsoleEntry[] = [
  { ts: '14:22:01', level: 'info', msg: '✦ Copilot applied template: momentum_nvda' },
  { ts: '14:22:01', level: 'info', msg: 'Pipeline loaded · 5 nodes · 6 edges' },
  { ts: '14:22:02', level: 'warn', msg: '⚠ Potential lookahead in ema_1 — ask copilot' },
  { ts: '14:22:02', level: 'ok', msg: 'Schema validated. Ready to run.' },
]

const LEVEL_CLASS: Record<ConsoleEntry['level'], string> = {
  ok: 'text-eq-green',
  warn: 'text-eq-amber',
  err: 'text-eq-red',
  info: 'text-eq-blue',
}

const MIN_HEIGHT = 80
const MAX_HEIGHT = 480
const HEADER_HEIGHT = 28
const MIN_SPLIT = 0.15
const MAX_SPLIT = 0.85

export function BottomDrawer() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerHeight, setDrawerHeight] = useState(140)
  const [splitRatio, setSplitRatio] = useState(0.5)
  const { nodes } = useCanvasStore()

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
            {nodes.map((n) => (
              <div
                key={n.id}
                className="flex items-center gap-2 py-0.5 border-b border-eq-border text-[10px] font-mono"
              >
                <span className="text-eq-blue flex-1 truncate">{n.data.id}.df</span>
                <span className="text-eq-t3 text-[9px]">
                  {n.data.status === 'success' ? '✓' : 'pending'}
                </span>
              </div>
            ))}
          </div>

          {/* Horizontal resize handle */}
          <div
            onPointerDown={onHorizontalDragStart}
            onDoubleClick={() => setSplitRatio(0.5)}
            className="w-1 cursor-ew-resize bg-eq-border hover:bg-eq-accent/40 transition-colors flex-shrink-0"
            title="Drag to resize · double-click to reset"
          />

          {/* Console pane */}
          <div className="flex-1 p-2 overflow-y-auto">
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
