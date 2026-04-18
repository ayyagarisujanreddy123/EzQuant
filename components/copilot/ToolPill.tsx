import type { ToolCall } from '@/types'

const TOOL_DOT: Record<string, string> = {
  search_knowledge: 'bg-eq-blue',
  get_live_market_data: 'bg-eq-green',
  suggest_pipeline_template: 'bg-eq-accent',
  ingest_document: 'bg-eq-blue',
}

export function ToolPill({ toolCall }: { toolCall: ToolCall }) {
  const dotClass = TOOL_DOT[toolCall.tool] ?? 'bg-eq-t3'
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono text-eq-t2 border bg-bg-3 ${
        toolCall.status === 'done' ? 'border-eq-green/30' : 'border-eq-border-2'
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
      <span>{toolCall.tool}</span>
      <span className="text-eq-t3 ml-auto pl-2">{toolCall.summary}</span>
    </div>
  )
}
