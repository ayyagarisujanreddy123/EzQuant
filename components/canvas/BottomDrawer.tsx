'use client'
import { useState } from 'react'
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

export function BottomDrawer() {
  const [collapsed, setCollapsed] = useState(false)
  const { nodes } = useCanvasStore()

  return (
    <div
      className={`bg-bg-1 border-t border-eq-border flex-shrink-0 transition-all ${
        collapsed ? 'h-7' : 'h-[110px]'
      }`}
    >
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
        <div className="grid grid-cols-2 h-[calc(110px-28px)] overflow-hidden">
          <div className="border-r border-eq-border p-2 overflow-y-auto">
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
