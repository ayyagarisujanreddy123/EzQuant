import type {
  Project,
  PipelineGraph,
} from '@/types'
import { MOCK_NVDA_GRAPH } from '@/lib/mocks/mockCanvasState'
import { createClient } from '@/lib/supabase/client'

// ── Copilot — real SSE stream via backend (replaces the prior mock) ─────────
export { streamCopilotChat } from './copilot'

// Reference kept so the import stays live for any future fallback.
void MOCK_NVDA_GRAPH

// ── Projects (Supabase) ──────────────────────────────────────────────────────
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

export async function fetchProjects(): Promise<Project[]> {
  const sb = createClient()
  const { data, error } = await sb
    .from('projects')
    .select('id, name, sharpe, block_count, status, updated_at, graph')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => rowToProject(r as ProjectRow))
}

export async function fetchProject(id: string): Promise<Project> {
  const sb = createClient()
  const { data, error } = await sb
    .from('projects')
    .select('id, name, sharpe, block_count, status, updated_at, graph')
    .eq('id', id)
    .single()
  if (error) throw error
  return rowToProject(data as ProjectRow)
}

export async function createProject(input: {
  name: string
  graph?: PipelineGraph
}): Promise<Project> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const graph = input.graph ?? { nodes: [], edges: [] }
  const { data, error } = await sb
    .from('projects')
    .insert({
      user_id: user.id,
      name: input.name,
      graph,
      block_count: graph.nodes.length,
      status: 'draft',
    })
    .select('id, name, sharpe, block_count, status, updated_at, graph')
    .single()
  if (error) throw error
  return rowToProject(data as ProjectRow)
}

export async function deleteProject(id: string): Promise<void> {
  const sb = createClient()
  const { error } = await sb.from('projects').delete().eq('id', id)
  if (error) throw error
}

export async function saveProject(input: {
  id: string
  name?: string
  graph: PipelineGraph
}): Promise<Project> {
  const sb = createClient()
  const { data, error } = await sb
    .from('projects')
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      graph: input.graph,
      block_count: input.graph.nodes.length,
    })
    .eq('id', input.id)
    .select('id, name, sharpe, block_count, status, updated_at, graph')
    .single()
  if (error) throw error
  return rowToProject(data as ProjectRow)
}

// ── Pipeline run — real, wired to FastAPI /api/pipeline/run ──────────────────
export { runPipeline, fetchRun } from './pipeline'

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
