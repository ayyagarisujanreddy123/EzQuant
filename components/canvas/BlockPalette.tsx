'use client'
import { BLOCK_CATALOG, CATEGORY_SECTIONS, CATEGORY_DOT, CATALOG_BY_TYPE } from '@/lib/blocks/catalog'
import { useCanvasStore } from '@/stores/canvasStore'
import type { BlockType, CanvasNode } from '@/types'

export function BlockPalette() {
  const handleDragStart = (e: React.DragEvent, blockType: string) => {
    e.dataTransfer.setData('application/block-type', blockType)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleClick = (blockType: BlockType, stretch?: boolean) => {
    if (stretch) return
    const def = CATALOG_BY_TYPE[blockType]
    if (!def) return
    const state = useCanvasStore.getState()
    const defaultParams = Object.fromEntries(
      def.paramsSchema.map((p) => [p.key, p.default])
    )
    const nodeId = crypto.randomUUID()
    const existing = state.nodes
    const maxX = existing.length ? Math.max(...existing.map((n) => n.position.x)) : -140
    const newNode: CanvasNode = {
      id: nodeId,
      type: blockType,
      position: {
        x: maxX + 180,
        y: 80 + (existing.length % 3) * 100,
      },
      data: {
        id: nodeId,
        name: def.label,
        category: def.category,
        status: 'idle',
        source: 'user',
        blockType: def.type,
        params: defaultParams,
      },
    }
    state.addNodes([newNode])
    state.setSelected(nodeId)
  }

  return (
    <div className="w-[145px] bg-bg-1 border-r border-eq-border overflow-y-auto flex-shrink-0 py-2.5 px-1.5">
      {CATEGORY_SECTIONS.map(({ category, label }) => {
        const blocks = BLOCK_CATALOG.filter((b) => b.category === category)
        return (
          <div key={category} className="mb-3.5">
            <div className="text-[9px] font-medium text-eq-t3 uppercase tracking-[0.7px] px-1 mb-1">
              {label}
            </div>
            {blocks.map((block) => (
              <button
                key={block.type}
                type="button"
                draggable={!block.stretch}
                onDragStart={(e) => handleDragStart(e, block.type)}
                onClick={() => handleClick(block.type, block.stretch)}
                disabled={block.stretch}
                className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-[10.5px] text-eq-t2 cursor-pointer hover:bg-bg-3 hover:text-eq-t1 active:bg-bg-4 transition-all mb-px text-left ${
                  block.stretch ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title={block.stretch ? 'Coming soon' : `Click to add · drag to position`}
              >
                <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${CATEGORY_DOT[category]}`} />
                {block.label}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
