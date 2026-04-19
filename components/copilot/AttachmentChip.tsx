import type { Attachment } from '@/types'
import { X } from 'lucide-react'

export function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment
  onRemove: () => void
}) {
  const iconClass = attachment.type === 'image' ? 'bg-eq-accent' : 'bg-eq-amber'
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-bg-3 border border-eq-border-2 text-[9px] font-mono text-eq-t2">
      <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${iconClass}`} />
      <span className="max-w-[120px] truncate">{attachment.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-eq-t3 hover:text-eq-t1 ml-0.5"
      >
        <X size={10} />
      </button>
    </div>
  )
}
