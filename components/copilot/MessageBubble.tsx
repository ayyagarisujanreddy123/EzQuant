import type { Message } from '@/types'
import { ToolPill } from './ToolPill'
import { CitationChip } from './CitationChip'
import { AppliedBanner } from './AppliedBanner'

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex flex-col gap-1">
        {message.attachmentNote && (
          <div className="self-end text-[10px] text-eq-t3 font-mono">
            {message.attachmentNote}
          </div>
        )}
        <div className="self-end max-w-[85%] px-2.5 py-1.5 rounded-lg rounded-br-sm text-[11px] leading-relaxed bg-bg-2 border border-eq-border text-eq-t1">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan" />
        <span className="text-[9px] uppercase tracking-wider text-eq-t3 font-mono">
          Copilot
        </span>
      </div>
      {message.toolCalls?.map((tc, i) => (
        <ToolPill key={i} toolCall={tc} />
      ))}
      {message.content && (
        <p className="text-[11px] leading-relaxed text-eq-t1">{message.content}</p>
      )}
      {message.appliedTemplate && <AppliedBanner />}
      {message.citations && message.citations.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {message.citations.map((c, i) => (
            <CitationChip key={i} citation={c} />
          ))}
        </div>
      )}
    </div>
  )
}
