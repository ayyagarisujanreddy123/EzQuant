import type { Project, PipelineGraph } from '@/types'
import { MOCK_NVDA_GRAPH } from '@/lib/mocks/mockCanvasState'
import { resolveBackendUrl } from './baseUrl'
import { readUser } from '@/lib/user'

// ── Copilot — real SSE stream via backend ──────────────────────────────────
export { streamCopilotChat } from './copilot'

// Reference kept so the import stays live for any future fallback.
void MOCK_NVDA_GRAPH

// ── Projects — proxied through FastAPI /api/simple/projects ────────────────
//
// Simple-identity mode: every call sends the localStorage `user_id` to the
// backend, which uses the Supabase service-role key to insert / fetch rows
// filtered by that id. No Supabase session, no RLS, no JWT.

interface ProjectRow {
  id: string
  name: string
  sharpe: number | null
  block_count: number | null
  status: string | null
  updated_at: string
  graph: PipelineGraph | null
}

function rowToProject(row: ProjectRow): Project {
  const graph = row.graph ?? { nodes: [], edges: [] }
  return {
    id: row.id,
    name: row.name,
    sharpe: row.sharpe ?? 0,
    blockCount: row.block_count ?? graph.nodes.length,
    status: row.status === 'warning' ? 'warning' : 'healthy',
    updatedAt: relativeTime(row.updated_at),
    graph,
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function requireUserId(): string {
  const u = readUser()
  if (!u) throw new Error('No user — open /enter to set name + DOB')
  return u.id
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveBackendUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body.detail ?? body.error ?? detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

export async function fetchProjects(): Promise<Project[]> {
  const user_id = requireUserId()
  const body = await request<{ projects: ProjectRow[] }>(
    `/api/simple/projects?user_id=${encodeURIComponent(user_id)}`
  )
  return (body.projects ?? []).map(rowToProject)
}

export async function fetchProject(id: string): Promise<Project> {
  const user_id = requireUserId()
  const row = await request<ProjectRow>(
    `/api/simple/projects/${encodeURIComponent(id)}?user_id=${encodeURIComponent(user_id)}`
  )
  return rowToProject(row)
}

export async function createProject(input: {
  name: string
  graph?: PipelineGraph
}): Promise<Project> {
  const user_id = requireUserId()
  const row = await request<ProjectRow>('/api/simple/projects', {
    method: 'POST',
    body: JSON.stringify({
      user_id,
      name: input.name,
      graph: input.graph ?? { nodes: [], edges: [] },
    }),
  })
  return rowToProject(row)
}

export async function deleteProject(id: string): Promise<void> {
  const user_id = requireUserId()
  await request<{ ok: boolean }>(
    `/api/simple/projects/${encodeURIComponent(id)}?user_id=${encodeURIComponent(user_id)}`,
    { method: 'DELETE' }
  )
}

export async function saveProject(input: {
  id: string
  name?: string
  graph: PipelineGraph
}): Promise<Project> {
  const user_id = requireUserId()
  const row = await request<ProjectRow>(
    `/api/simple/projects/${encodeURIComponent(input.id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        user_id,
        name: input.name,
        graph: input.graph,
      }),
    }
  )
  return rowToProject(row)
}

// ── Pipeline run — real, wired to FastAPI /api/pipeline/run ────────────────
export { runPipeline, fetchRun } from './pipeline'
