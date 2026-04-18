'use client'
import { useEffect, useRef, useState } from 'react'
import { Paperclip, Image as ImageIcon, RotateCcw, Send } from 'lucide-react'
import { useCopilot } from '@/hooks/useCopilot'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { AttachmentChip } from './AttachmentChip'
import type { PageContext, Message, PipelineGraph, CopilotMode } from '@/types'

interface Props {
  pageContext: PageContext
  initialMessages?: Message[]
  onPipelineGenerated?: (graph: PipelineGraph) => void
  subtitle?: string
}

const SLASH_COMMANDS = ['/template', '/ask', '/debug']

const MODES: { id: CopilotMode; label: string }[] = [
  { id: 'ask', label: 'Ask' },
  { id: 'suggest', label: 'Suggest' },
  { id: 'debug', label: 'Debug' },
]

export function CopilotPanel({
  pageContext,
  initialMessages,
  onPipelineGenerated,
  subtitle = 'gemini-2.0-flash · rag',
}: Props) {
  const {
    messages,
    isStreaming,
    mode,
    setMode,
    send,
    attachments,
    addAttachment,
    removeAttachment,
    clearMessages,
  } = useCopilot({ pageContext, initialMessages, onPipelineGenerated })

  const [draft, setDraft] = useState('')
  const [showSlash, setShowSlash] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  useEffect(() => {
    const handler = () => textareaRef.current?.focus()
    document.addEventListener('focus-composer', handler)
    return () => document.removeEventListener('focus-composer', handler)
  }, [])

  const handleSend = () => {
    if (!draft.trim()) return
    send(draft)
    setDraft('')
    setShowSlash(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setDraft(v)
    setShowSlash(v === '/')
  }

  const handleFileAttach = (type: 'image' | 'pdf') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = type === 'image' ? 'image/*' : '.pdf'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      addAttachment({ id: crypto.randomUUID(), name: file.name, type, file })
    }
    input.click()
  }

  const contextLabel = {
    projects: `Projects page · ${pageContext.savedProjectCount ?? 4} saved pipelines`,
    canvas: `Canvas · ${pageContext.projectName ?? 'Untitled'} · ${
      pageContext.blockCount ?? 0
    } blocks`,
    gallery: `Template gallery · ${pageContext.templateCount ?? 3} loaded`,
  }[pageContext.page]

  return (
    <div className="flex flex-col bg-bg-1 border-l border-eq-border overflow-hidden h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-2 border-b border-eq-border flex-shrink-0">
        <div className="w-5 h-5 rounded-full bg-gemini flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
          ✦
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-eq-t1">Quant Copilot</div>
          <div className="text-[9px] text-eq-t3 font-mono">{subtitle}</div>
        </div>
        <button
          type="button"
          onClick={clearMessages}
          className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-3 transition-colors"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* Context strip */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-eq-cyan-dim/30 border-b border-eq-border text-[10px] text-eq-cyan flex-shrink-0">
        <div className="w-1 h-1 rounded-full bg-eq-cyan flex-shrink-0" />
        Context: {contextLabel}
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 px-2.5 py-1.5 border-b border-eq-border flex-shrink-0">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={`flex-1 py-1 rounded text-[10px] font-medium transition-colors border ${
              mode === m.id
                ? 'text-eq-t1 bg-bg-3 border-eq-accent/35'
                : 'text-eq-t2 bg-bg-2 border-eq-border hover:text-eq-t1'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Thread */}
      <div
        ref={threadRef}
        className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0"
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isStreaming && <ThinkingIndicator />}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 p-2.5 border-t border-eq-border bg-bg-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {attachments.map((a) => (
              <AttachmentChip
                key={a.id}
                attachment={a}
                onRemove={() => removeAttachment(a.id)}
              />
            ))}
          </div>
        )}
        <div className="relative bg-bg-3 border border-eq-border-2 rounded-lg p-2 flex flex-col gap-1.5">
          {showSlash && (
            <div className="absolute bottom-full left-0 mb-1 w-full bg-bg-3 border border-eq-border-2 rounded-lg overflow-hidden shadow-xl z-10">
              {SLASH_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => {
                    setDraft(cmd + ' ')
                    setShowSlash(false)
                    textareaRef.current?.focus()
                  }}
                  className="w-full px-3 py-1.5 text-left text-[10px] font-mono text-eq-t2 hover:bg-bg-4 hover:text-eq-t1 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, or /template /ask /debug"
            rows={1}
            data-composer="true"
            className="w-full bg-transparent border-none text-[11px] text-eq-t1 placeholder:text-eq-t3 font-sans outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleFileAttach('image')}
              className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-4 transition-colors"
              aria-label="Attach image"
            >
              <ImageIcon size={12} />
            </button>
            <button
              type="button"
              onClick={() => handleFileAttach('pdf')}
              className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-4 transition-colors"
              aria-label="Attach PDF"
            >
              <Paperclip size={12} />
            </button>
            <span className="text-[9px] text-eq-t3 font-mono ml-auto mr-1">
              / for commands
            </span>
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim() || isStreaming}
              className="w-6 h-5 rounded bg-eq-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-eq-accent-2 transition-colors"
              aria-label="Send"
            >
              <Send size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
