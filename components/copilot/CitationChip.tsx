import type { Citation } from '@/types'

export function CitationChip({ citation }: { citation: Citation }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-mono text-eq-t2 bg-bg-2 border border-eq-border hover:border-eq-border-2 hover:text-eq-t1 transition-colors"
    >
      <span className="w-3 h-3 rounded-full bg-eq-accent-dim text-eq-accent text-[8px] flex items-center justify-center font-medium">
        {citation.num}
      </span>
      {citation.source}
    </button>
  )
}
