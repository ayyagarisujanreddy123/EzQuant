import type {
  CanvasNode,
  CanvasEdge,
  PipelineGraph,
  RunResponse,
} from '@/types'
import { resolveBackendUrl } from './baseUrl'

interface RunOptions {
  projectId?: string | null
  /** Execute the subgraph that ends at this node id (Evaluate behavior). */
  runTo?: string
  /** Persist to pipeline_runs. Full Runs true; Evaluates false. */
  persist?: boolean
}

export async function runPipeline(
  graph: PipelineGraph,
  options: RunOptions = {}
): Promise<RunResponse> {
  const body = {
    pipeline: {
      nodes: graph.nodes.map(serializeNode),
      edges: graph.edges.map(serializeEdge),
    },
    project_id: options.projectId ?? null,
    run_to: options.runTo ?? null,
    persist: options.persist ?? true,
  }

  const res = await fetch(`${resolveBackendUrl()}/api/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await safeErrorDetail(res)
    throw new Error(detail)
  }
  return res.json()
}

export async function fetchRun(runId: string): Promise<RunResponse> {
  const res = await fetch(`${resolveBackendUrl()}/api/pipeline/runs/${runId}`)
  if (!res.ok) throw new Error(await safeErrorDetail(res))
  return res.json()
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function safeErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body.detail || body.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

function serializeNode(n: CanvasNode) {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      id: n.data.id,
      name: n.data.name,
      blockType: n.data.blockType,
      params: n.data.params ?? {},
      category: n.data.category,
      status: n.data.status,
      source: n.data.source,
    },
  }
}

function serializeEdge(e: CanvasEdge) {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    targetPort: (e.data as { targetPort?: string } | undefined)?.targetPort,
    data: e.data ?? null,
  }
}
