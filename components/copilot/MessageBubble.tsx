import type { Message } from '@/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
        <div className="self-end max-w-[85%] px-2.5 py-1.5 rounded-lg rounded-br-sm text-[11px] leading-relaxed bg-bg-2 border border-eq-border text-eq-t1 whitespace-pre-wrap">
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
        <div className="copilot-md text-[11px] leading-relaxed text-eq-t1">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
              ul: ({ children }) => (
                <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>
              ),
              li: ({ children }) => <li className="marker:text-eq-t3">{children}</li>,
              strong: ({ children }) => (
                <strong className="text-eq-t1 font-semibold">{children}</strong>
              ),
              em: ({ children }) => <em className="text-eq-t2">{children}</em>,
              code: ({ children }) => (
                <code className="px-1 py-[1px] rounded bg-bg-3 border border-eq-border-2 text-eq-cyan text-[10px] font-mono">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="bg-bg-3 border border-eq-border-2 rounded p-2 my-1.5 text-[10px] font-mono text-eq-t2 overflow-x-auto">
                  {children}
                </pre>
              ),
              h1: ({ children }) => (
                <h3 className="text-[12px] font-semibold text-eq-t1 mt-1 mb-1">{children}</h3>
              ),
              h2: ({ children }) => (
                <h3 className="text-[12px] font-semibold text-eq-t1 mt-1 mb-1">{children}</h3>
              ),
              h3: ({ children }) => (
                <h4 className="text-[11px] font-semibold text-eq-t1 mt-1 mb-0.5">{children}</h4>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-eq-cyan underline decoration-eq-cyan/40 hover:decoration-eq-cyan"
                >
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-eq-accent/40 pl-2 text-eq-t2 italic my-1.5">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="my-1.5 overflow-x-auto">
                  <table className="text-[10px] border border-eq-border rounded">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="px-1.5 py-0.5 text-left text-eq-t3 border-b border-eq-border bg-bg-2">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-1.5 py-0.5 border-b border-eq-border/60 text-eq-t1">
                  {children}
                </td>
              ),
              hr: () => <hr className="border-eq-border my-1.5" />,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
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
