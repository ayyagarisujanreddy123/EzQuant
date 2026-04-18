'use client'
import { BLOCK_CATALOG, CATEGORY_SECTIONS, CATEGORY_DOT } from '@/lib/blocks/catalog'

export function BlockPalette() {
  const handleDragStart = (e: React.DragEvent, blockType: string) => {
    e.dataTransfer.setData('application/block-type', blockType)
    e.dataTransfer.effectAllowed = 'copy'
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
              <div
                key={block.type}
                draggable
                onDragStart={(e) => handleDragStart(e, block.type)}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-[10.5px] text-eq-t2 cursor-grab hover:bg-bg-3 hover:text-eq-t1 transition-all mb-px ${
                  block.stretch ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${CATEGORY_DOT[category]}`} />
                {block.label}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
