'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { streamCopilotChat } from '@/lib/api/placeholders'
import { useCanvasStore } from '@/stores/canvasStore'
import { serializeCanvas } from '@/lib/canvas/serialize'
import type {
  Message,
  CopilotMode,
  Attachment,
  PageContext,
  PipelineGraph,
  PipelineTemplate,
  Citation,
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
  const sessionIdRef = useRef<string>('')

  // Stable session_id per (user, project). Scoped to the browser via localStorage.
  useEffect(() => {
    try {
      const key = `ezq_chat_session:${pageContext.projectId ?? 'global'}`
      const existing = localStorage.getItem(key)
      if (existing) {
        sessionIdRef.current = existing
      } else {
        const fresh = crypto.randomUUID()
        localStorage.setItem(key, fresh)
        sessionIdRef.current = fresh
      }
    } catch {
      sessionIdRef.current = crypto.randomUUID()
    }
  }, [pageContext.projectId])

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

      // Serialize current canvas state so the agent has context.
      const store = useCanvasStore.getState()
      const canvasState = serializeCanvas(store.nodes, store.edges, {
        selectedNodeId: store.selectedNodeId,
        lastRunResults: store.lastRunResults,
      })

      try {
        for await (const event of streamCopilotChat(
          text,
          pageContext,
          sentAttachments,
          {
            sessionId: sessionIdRef.current || 'default',
            projectId: pageContext.projectId ?? null,
            canvasState,
            mode,
          }
        )) {
          switch (event.type) {
            case 'text':
              setMessages((p) =>
                p.map((m) =>
                  m.id === agentId ? { ...m, content: (m.content ?? '') + event.content } : m
                )
              )
              break
            case 'tool_use': {
              const status = event.status ?? 'running'
              setMessages((p) =>
                p.map((m) => {
                  if (m.id !== agentId) return m
                  const existing = (m.toolCalls ?? []).find(
                    (tc) => tc.tool === event.tool && tc.status !== 'done'
                  )
                  if (existing && status === 'done') {
                    return {
                      ...m,
                      toolCalls: (m.toolCalls ?? []).map((tc) =>
                        tc === existing
                          ? { ...tc, summary: event.summary, status: 'done' as const }
                          : tc
                      ),
                    }
                  }
                  if (existing) return m
                  return {
                    ...m,
                    toolCalls: [
                      ...(m.toolCalls ?? []),
                      {
                        tool: event.tool,
                        summary: event.summary,
                        status: status as 'running' | 'done',
                      },
                    ],
                  }
                })
              )
              break
            }
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
            case 'citations': {
              const list: Citation[] =
                (event.sources as Citation[] | undefined) ??
                (event.citations as Citation[] | undefined) ??
                []
              setMessages((p) =>
                p.map((m) => (m.id === agentId ? { ...m, citations: list } : m))
              )
              break
            }
            case 'applied_banner':
              setMessages((p) =>
                p.map((m) => (m.id === agentId ? { ...m, appliedTemplate: true } : m))
              )
              break
            case 'suggest_pipeline_template':
              // Legacy mock path — forwards the raw graph to the canvas callback.
              onPipelineGenerated?.(event.graph)
              break
            case 'pipeline_template': {
              // Agent path — stage as ghosted, awaiting user approval.
              const tpl: PipelineTemplate = event.template
              useCanvasStore.getState().stagePipelineTemplate(tpl)
              setMessages((p) =>
                p.map((m) =>
                  m.id === agentId ? { ...m, appliedTemplate: true } : m
                )
              )
              break
            }
            case 'image':
              setMessages((p) =>
                p.map((m) =>
                  m.id === agentId
                    ? {
                        ...m,
                        images: [
                          ...(m.images ?? []),
                          { mime: event.mime, data_b64: event.data_b64 },
                        ],
                      }
                    : m
                )
              )
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
    [isStreaming, attachments, pageContext, onPipelineGenerated, mode]
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
