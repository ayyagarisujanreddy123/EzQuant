'use client'
import { useState, useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { CATALOG_BY_TYPE } from '@/lib/blocks/catalog'
import type { CanvasNode } from '@/types'

type Tab = 'data' | 'params' | 'eval'

const TABS: { id: Tab; label: string }[] = [
  { id: 'data', label: 'Data' },
  { id: 'params', label: 'Params' },
  { id: 'eval', label: 'Eval' },
]

export function Inspector() {
  const [tab, setTab] = useState<Tab>('data')
  const { nodes, selectedNodeId, updateParam } = useCanvasStore()
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
          <ParamsTab node={node} updateParam={updateParam} />
        ) : (
          <EvalTab node={node} />
        )}
      </div>
    </div>
  )
}

function DataTab({ node }: { node: CanvasNode }) {
  const q = node.data.quality
  return (
    <div>
      <div className="text-[11px] font-medium text-eq-t1 mb-2">{node.data.name}</div>
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
          {q.sparkline && (
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
        <p className="text-[10px] text-eq-t3 mt-2">No data quality info available</p>
      )}
    </div>
  )
}

function ParamsTab({
  node,
  updateParam,
}: {
  node: CanvasNode
  updateParam: (id: string, key: string, value: string | number | boolean) => void
}) {
  const def = CATALOG_BY_TYPE[node.data.blockType]
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
