import type {
  CopilotEvent,
  PageContext,
  Attachment,
} from '@/types'
import { createClient } from '@/lib/supabase/client'
import { resolveBackendUrl } from './baseUrl'

// Cap per-image payload so we don't blow the request body.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024 // 4 MB raw; ~5.3 MB after base64

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

  // Read file bytes for image attachments. PDFs and others pass metadata only.
  const preparedAttachments = await Promise.all(
    (attachments ?? []).map(async (a) => {
      if (a.type !== 'image' || !a.file) {
        return { id: a.id, name: a.name, type: a.type }
      }
      if (a.file.size > MAX_IMAGE_BYTES) {
        return {
          id: a.id,
          name: a.name,
          type: a.type,
          error: `Image too large (${(a.file.size / 1024 / 1024).toFixed(1)} MB > 4 MB cap)`,
        }
      }
      const buf = await a.file.arrayBuffer()
      return {
        id: a.id,
        name: a.name,
        type: 'image' as const,
        mime: a.file.type || 'image/png',
        data_b64: bytesToBase64(new Uint8Array(buf)),
      }
    })
  )

  const body = {
    message,
    page_context: pageContext,
    session_id: opts.sessionId,
    project_id: opts.projectId ?? null,
    canvas_state: opts.canvasState ?? null,
    mode: opts.mode ?? 'ask',
    attachments: preparedAttachments,
  }

  const res = await fetch(`${resolveBackendUrl()}/api/agent/chat`, {
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

/**
 * btoa() chokes on multi-byte chars and throws on large inputs. Build base64
 * in chunks to handle ≤4MB images without RangeError on String.fromCharCode.
 */
function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let s = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK) as unknown as number[]
    s += String.fromCharCode.apply(null, slice)
  }
  return btoa(s)
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
