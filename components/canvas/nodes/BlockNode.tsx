import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CATEGORY_DOT } from '@/lib/blocks/catalog'
import type { CanvasNode } from '@/types'

const STATUS_DOT: Record<string, string> = {
  idle: 'bg-eq-t3',
  running: 'bg-eq-cyan animate-pulse',
  success: 'bg-eq-green',
  error: 'bg-eq-red',
  skipped: 'bg-eq-amber',
}

export function BlockNode({ data, selected }: NodeProps<CanvasNode>) {
  const isCopilot = data.source === 'copilot'
  const firstParamEntry = Object.entries(data.params)[0]
  const paramPreview = firstParamEntry ? `${firstParamEntry[0]}: ${firstParamEntry[1]}` : ''

  return (
    <div
      className={`w-[130px] bg-bg-2 border rounded-[7px] text-[10px] cursor-pointer transition-all ${
        selected
          ? 'border-eq-accent shadow-[0_0_0_2px_rgba(139,125,255,0.14)]'
          : isCopilot
          ? 'border-eq-cyan shadow-[0_0_0_2px_rgba(34,211,238,0.12)]'
          : 'border-eq-border-2 hover:border-white/25'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-bg-4 !border !border-eq-border-2 !rounded-full"
      />
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-eq-border">
        <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${CATEGORY_DOT[data.category]}`} />
        <span className="flex-1 text-[8px] text-eq-t3 font-mono uppercase tracking-wider truncate">
          {data.blockType.replace(/_/g, ' ')}
        </span>
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[data.status]}`} />
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-medium text-eq-t1 mb-0.5 truncate">{data.name}</div>
        <div className="text-[9px] text-eq-t3 font-mono truncate">{paramPreview}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-bg-4 !border !border-eq-border-2 !rounded-full"
      />
    </div>
  )
}
