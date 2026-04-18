import type {
  CopilotEvent,
  Project,
  PipelineGraph,
  RunResult,
  PageContext,
  Attachment,
} from '@/types'
import { MOCK_PROJECTS } from '@/lib/mocks/mockProjects'
import { MOCK_NVDA_GRAPH } from '@/lib/mocks/mockCanvasState'

// TODO: wire to POST /api/agent/chat SSE endpoint
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

// TODO: wire to Supabase `projects` table
export async function fetchProjects(): Promise<Project[]> {
  await delay(150)
  return MOCK_PROJECTS
}

// TODO: wire to Supabase `projects` table
export async function fetchProject(id: string): Promise<Project> {
  await delay(150)
  const p = MOCK_PROJECTS.find((p) => p.id === id) ?? MOCK_PROJECTS[3]
  return { ...p, graph: p.graph ?? MOCK_NVDA_GRAPH }
}

// TODO: wire to POST /api/pipeline/run
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
