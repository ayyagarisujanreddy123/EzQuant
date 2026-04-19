'use client'
import { useEffect, useRef, useState } from 'react'
import { Paperclip, Image as ImageIcon, RotateCcw, Send, X } from 'lucide-react'
import { useCopilot } from '@/hooks/useCopilot'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { AttachmentChip } from './AttachmentChip'
import { BloomAvatar } from './BloomAvatar'
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
  const [isOpen, setIsOpen] = useState(false)
  const [showGreeting, setShowGreeting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const threadRef = useRef<HTMLDivElement>(null)

  // First-encounter greeting — show the speech bubble once per user (per
  // browser), then persist a flag so it never nags again.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem('bloom_greeted')) return
    } catch {
      return
    }
    const t = setTimeout(() => setShowGreeting(true), 900)
    return () => clearTimeout(t)
  }, [])

  const dismissGreeting = () => {
    setShowGreeting(false)
    try {
      localStorage.setItem('bloom_greeted', '1')
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  useEffect(() => {
    const focusHandler = () => {
      setIsOpen(true)
      // wait a tick for the textarea to mount
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
    const toggleHandler = () => setIsOpen((o) => !o)
    document.addEventListener('focus-composer', focusHandler)
    document.addEventListener('toggle-copilot', toggleHandler)
    return () => {
      document.removeEventListener('focus-composer', focusHandler)
      document.removeEventListener('toggle-copilot', toggleHandler)
    }
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

  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    const max = 160
    el.style.height = Math.min(el.scrollHeight, max) + 'px'
    el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden'
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    setDraft(v)
    setShowSlash(v === '/')
    autosize(e.currentTarget)
  }

  // Keep height in sync when `draft` is cleared after send / cleared externally.
  useEffect(() => {
    autosize(textareaRef.current)
  }, [draft])

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
    <>
      {/* Floating FAB — visible when panel closed */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true)
            dismissGreeting()
          }}
          aria-label="Open Bloom"
          className="fixed bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform z-50"
        >
          <span className="bloom-float inline-flex items-center justify-center rounded-full shadow-xl shadow-black/50">
            <BloomAvatar size={56} active={isStreaming} />
          </span>
          <style>{`
            .bloom-float {
              animation: bloomFloat 4.8s ease-in-out infinite;
            }
            @keyframes bloomFloat {
              0%, 100% { transform: translate(0, 0) rotate(-1.5deg); }
              25%      { transform: translate(-2.5px, -4px) rotate(-3deg); }
              50%      { transform: translate(0, -6px) rotate(0deg); }
              75%      { transform: translate(2.5px, -4px) rotate(3deg); }
            }
            @media (prefers-reduced-motion: reduce) {
              .bloom-float { animation: none; }
            }
          `}</style>
        </button>
      )}

      {/* First-encounter greeting — shows once, dismisses on click */}
      {!isOpen && showGreeting && (
        <div
          className="fixed bottom-7 right-[84px] z-50 max-w-[240px] bloom-greet-enter"
          role="status"
          aria-live="polite"
        >
          <div className="relative bg-bg-1 border border-eq-cyan/45 rounded-xl px-3.5 py-2.5 shadow-xl shadow-black/40">
            <button
              type="button"
              onClick={dismissGreeting}
              aria-label="Dismiss greeting"
              className="absolute top-1 right-1 w-4 h-4 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-3 transition-colors"
            >
              <X size={10} />
            </button>
            <div className="text-[11.5px] font-semibold text-eq-t1 mb-0.5">
              Hey! <span className="text-gemini">✦</span>
            </div>
            <div className="text-[11px] text-eq-t2 leading-relaxed pr-2">
              How can I assist you today?
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(true)
                dismissGreeting()
              }}
              className="mt-2 text-[10px] font-medium text-eq-cyan hover:text-eq-accent transition-colors"
            >
              Start chatting →
            </button>
            {/* Tail — pointing right toward the FAB */}
            <div className="absolute right-[-7px] bottom-6 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[7px] border-l-[rgba(34,211,238,0.45)]" />
            <div className="absolute right-[-5px] bottom-6 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-bg-1" />
          </div>
          <style>{`
            .bloom-greet-enter {
              animation: bloomGreetIn 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            @keyframes bloomGreetIn {
              0% { opacity: 0; transform: translateY(6px) scale(0.92); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @media (prefers-reduced-motion: reduce) {
              .bloom-greet-enter { animation: none; }
            }
          `}</style>
        </div>
      )}

      {/* Floating panel — opens on FAB click / ⌘K */}
      {isOpen && (
        <div className="fixed top-14 right-4 bottom-4 w-[340px] bg-bg-1 border border-eq-border-2 rounded-xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden z-50 min-h-0">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-2 border-b border-eq-border flex-shrink-0">
            <BloomAvatar size={22} active={isStreaming} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-eq-t1">Bloom</div>
              <div className="text-[9px] text-eq-t3 font-mono">{subtitle}</div>
            </div>
            <button
              type="button"
              onClick={clearMessages}
              title="Clear thread"
              className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-3 transition-colors"
            >
              <RotateCcw size={12} />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              title="Close"
              className="w-5 h-5 rounded flex items-center justify-center text-eq-t3 hover:text-eq-t1 hover:bg-bg-3 transition-colors"
              aria-label="Close Bloom"
            >
              <X size={13} />
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
                wrap="soft"
                className="w-full bg-transparent border-none text-[11px] text-eq-t1 placeholder:text-eq-t3 font-sans outline-none resize-none leading-relaxed break-words whitespace-pre-wrap overflow-y-hidden max-h-40 block"
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
      )}
    </>
  )
}
