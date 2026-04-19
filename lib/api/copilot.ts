import type {
  CopilotEvent,
  PageContext,
  Attachment,
} from '@/types'
import { createClient } from '@/lib/supabase/client'

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

interface ChatOptions {
  sessionId: string
  projectId?: string | null
  canvasState?: string
  mode?: 'ask' | 'suggest' | 'debug'
}

/**
 * Stream agent events from POST /api/agent/chat (SSE).
 * Yields CopilotEvent objects — same shape the mock used, with the new
 * `pipeline_template` variant added by the backend orchestrator.
 */
export async function* streamCopilotChat(
  message: string,
  pageContext: PageContext,
  attachments?: Attachment[],
  opts: ChatOptions = { sessionId: 'default' }
): AsyncGenerator<CopilotEvent> {
  const token = await getAccessToken()
  if (!token) {
    yield { type: 'text', content: 'Not signed in.' }
    yield { type: 'done' }
    return
  }

  const body = {
    message,
    page_context: pageContext,
    session_id: opts.sessionId,
    project_id: opts.projectId ?? null,
    canvas_state: opts.canvasState ?? null,
    mode: opts.mode ?? 'ask',
    attachments: attachments?.map((a) => ({ id: a.id, name: a.name, type: a.type })),
  }

  const res = await fetch(`${BACKEND_URL}/api/agent/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok || !res.body) {
    const detail = await safeErrorDetail(res)
    yield { type: 'text', content: `Agent error: ${detail}` }
    yield { type: 'done' }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      // SSE frames are separated by a blank line.
      let idx = buf.indexOf('\n\n')
      while (idx !== -1) {
        const frame = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const event = parseFrame(frame)
        if (event) yield event
        idx = buf.indexOf('\n\n')
      }
    }
  } finally {
    try {
      reader.releaseLock()
    } catch {
      /* ignore */
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const sb = createClient()
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

async function safeErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body.detail || body.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

function parseFrame(frame: string): CopilotEvent | null {
  const dataLines = frame
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart())
  if (dataLines.length === 0) return null
  const jsonStr = dataLines.join('\n')
  try {
    return JSON.parse(jsonStr) as CopilotEvent
  } catch {
    return null
  }
}
