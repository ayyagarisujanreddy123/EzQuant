import type {
  CopilotEvent,
  Project,
  PipelineGraph,
  RunResult,
  PageContext,
  Attachment,
} from '@/types'
import { MOCK_NVDA_GRAPH } from '@/lib/mocks/mockCanvasState'
import { createClient } from '@/lib/supabase/client'

// ── Copilot (still mocked — TODO wire to POST /api/agent/chat SSE) ───────────
export async function* streamCopilotChat(
  message: string,
  _pageContext: PageContext,
  _attachments?: Attachment[]
): AsyncGenerator<CopilotEvent> {
  await delay(300)
  const isStrategyRequest = /backtest|momentum|strategy|pipeline|template/i.test(message)

  if (isStrategyRequest) {
    yield { type: 'tool_use', tool: 'search_knowledge', summary: 'searching...' }
    await delay(300)
    yield { type: 'tool_result', tool: 'search_knowledge', summary: '3 templates · 0.4s' }
    yield { type: 'tool_use', tool: 'get_live_market_data', summary: 'fetching...' }
    await delay(300)
    yield { type: 'tool_result', tool: 'get_live_market_data', summary: 'NVDA · 252 rows' }
    yield { type: 'tool_use', tool: 'suggest_pipeline_template', summary: 'generating...' }
    await delay(400)
    yield { type: 'suggest_pipeline_template', graph: MOCK_NVDA_GRAPH }
    yield { type: 'applied_banner' }
    yield {
      type: 'text',
      content:
        'I put together a 5-block pipeline — fetch NVDA, compute log returns, apply a 20-day EMA, threshold to positions, and backtest. Span=20 is a common starting point.',
    }
    yield {
      type: 'citations',
      citations: [
        { num: 1, source: 'momentum_template' },
        { num: 2, source: 'js_signals_ema' },
      ],
    }
  } else {
    yield { type: 'tool_use', tool: 'search_knowledge', summary: 'searching...' }
    await delay(400)
    yield { type: 'tool_result', tool: 'search_knowledge', summary: '4 chunks · 0.3s' }
    yield {
      type: 'text',
      content: `Placeholder response for: "${message}". Wire to POST /api/agent/chat to get real responses.`,
    }
  }
  yield { type: 'done' }
}

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

// ── Pipeline run (still mocked — TODO wire to POST /api/pipeline/run) ────────
export async function runPipeline(graph: PipelineGraph): Promise<RunResult> {
  await delay(1800)
  return {
    success: true,
    metrics: {
      sharpe: 1.67,
      maxDrawdown: -0.18,
      totalReturn: 0.84,
      annualizedReturn: 0.21,
      winRate: 0.54,
    },
    nodeStatuses: Object.fromEntries(graph.nodes.map((n) => [n.id, 'success' as const])),
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
