'use client'
import { useState, useCallback } from 'react'
import { streamCopilotChat } from '@/lib/api/placeholders'
import type {
  Message,
  CopilotMode,
  Attachment,
  PageContext,
  PipelineGraph,
} from '@/types'

interface UseCopilotOptions {
  pageContext: PageContext
  initialMessages?: Message[]
  onPipelineGenerated?: (graph: PipelineGraph) => void
}

export function useCopilot({
  pageContext,
  initialMessages = [],
  onPipelineGenerated,
}: UseCopilotOptions) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [mode, setMode] = useState<CopilotMode>('ask')
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const addAttachment = useCallback(
    (a: Attachment) => setAttachments((p) => [...p, a]),
    []
  )
  const removeAttachment = useCallback(
    (id: string) => setAttachments((p) => p.filter((a) => a.id !== id)),
    []
  )
  const clearMessages = useCallback(() => setMessages([]), [])

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
        attachmentNote: attachments.length
          ? attachments.map((a) => `📎 ${a.name}`).join(', ')
          : undefined,
      }
      setMessages((p) => [...p, userMsg])
      const sentAttachments = attachments
      setAttachments([])
      setIsStreaming(true)

      const agentId = crypto.randomUUID()
      setMessages((p) => [
        ...p,
        {
          id: agentId,
          role: 'agent',
          content: '',
          toolCalls: [],
          citations: [],
          timestamp: new Date(),
        },
      ])

      try {
        for await (const event of streamCopilotChat(text, pageContext, sentAttachments)) {
          switch (event.type) {
            case 'text':
              setMessages((p) =>
                p.map((m) =>
                  m.id === agentId ? { ...m, content: (m.content ?? '') + event.content } : m
                )
              )
              break
            case 'tool_use':
              setMessages((p) =>
                p.map((m) =>
                  m.id === agentId
                    ? {
                        ...m,
                        toolCalls: [
                          ...(m.toolCalls ?? []),
                          { tool: event.tool, summary: event.summary, status: 'running' as const },
                        ],
                      }
                    : m
                )
              )
              break
            case 'tool_result':
              setMessages((p) =>
                p.map((m) =>
                  m.id === agentId
                    ? {
                        ...m,
                        toolCalls: (m.toolCalls ?? []).map((tc) =>
                          tc.tool === event.tool
                            ? { ...tc, summary: event.summary, status: 'done' as const }
                            : tc
                        ),
                      }
                    : m
                )
              )
              break
            case 'citations':
              setMessages((p) =>
                p.map((m) => (m.id === agentId ? { ...m, citations: event.citations } : m))
              )
              break
            case 'applied_banner':
              setMessages((p) =>
                p.map((m) => (m.id === agentId ? { ...m, appliedTemplate: true } : m))
              )
              break
            case 'suggest_pipeline_template':
              onPipelineGenerated?.(event.graph)
              break
            case 'done':
              break
          }
        }
      } catch {
        setMessages((p) =>
          p.map((m) =>
            m.id === agentId ? { ...m, content: 'Error — please try again.' } : m
          )
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, attachments, pageContext, onPipelineGenerated]
  )

  return {
    messages,
    isStreaming,
    mode,
    setMode,
    send,
    attachments,
    addAttachment,
    removeAttachment,
    clearMessages,
  }
}
