import type { CanvasNode, CanvasEdge, NodeRunResult } from '@/types'

/**
 * Serialize the current canvas state into a compact JSON string suitable for
 * inclusion in an LLM system prompt. Budget: ~2000 tokens ≈ 8000 chars.
 *
 * Included:
 *   - nodes: id, type, name, key params
 *   - edges: id, source, target
 *   - lastRun: summary metrics per node with successful output (Sharpe, IC, ...)
 *   - selectedNodeId
 *
 * Truncated if it exceeds the budget.
 */
const MAX_CHARS = 7500
const MAX_PARAM_KEYS = 6
const MAX_METRIC_KEYS = 8

interface SerializeOptions {
  selectedNodeId?: string | null
  lastRunResults?: Record<string, NodeRunResult>
}

export function serializeCanvas(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  opts: SerializeOptions = {}
): string {
  const slimNodes = nodes.map((n) => ({
    id: n.id,
    type: n.data.blockType,
    name: n.data.name,
    status: n.data.status,
    params: slimParams(n.data.params),
  }))

  const slimEdges = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
  }))

  const lastRun: Record<string, unknown> = {}
  if (opts.lastRunResults) {
    for (const [id, r] of Object.entries(opts.lastRunResults)) {
      const entry: Record<string, unknown> = { status: r.status }
      if (r.error) entry.error = r.error
      if (r.metrics) entry.metrics = slimRecord(r.metrics as Record<string, unknown>, MAX_METRIC_KEYS)
      if (r.diagnostics) entry.diagnostics = slimDiagnostics(r.diagnostics)
      if (r.shape) entry.shape = r.shape
      lastRun[id] = entry
    }
  }

  const payload = {
    selectedNodeId: opts.selectedNodeId ?? null,
    nodes: slimNodes,
    edges: slimEdges,
    lastRun,
  }

  let out = JSON.stringify(payload)
  if (out.length <= MAX_CHARS) return out

  // Too big — drop lastRun first, then trim nodes.
  delete (payload as { lastRun?: unknown }).lastRun
  out = JSON.stringify(payload)
  if (out.length <= MAX_CHARS) return out + '\n/* lastRun dropped for token budget */'

  const half = Math.floor(slimNodes.length / 2)
  payload.nodes = [
    ...slimNodes.slice(0, half),
    { id: '…', type: 'elided', name: `${slimNodes.length - half} more`, status: 'idle', params: {} },
  ] as typeof slimNodes
  return JSON.stringify(payload) + '\n/* truncated for token budget */'
}

function slimParams(
  params: Record<string, string | number | boolean> | undefined
): Record<string, string | number | boolean> {
  if (!params) return {}
  const keys = Object.keys(params).slice(0, MAX_PARAM_KEYS)
  const out: Record<string, string | number | boolean> = {}
  for (const k of keys) out[k] = params[k]
  return out
}

function slimRecord(obj: Record<string, unknown>, maxKeys: number): Record<string, unknown> {
  const keys = Object.keys(obj).slice(0, maxKeys)
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v === null) {
      out[k] = v
    }
  }
  return out
}

function slimDiagnostics(d: NonNullable<NodeRunResult['diagnostics']>): Record<string, unknown> {
  return {
    ic: d.ic,
    ic_tstat: d.ic_tstat,
    n: d.n,
    signal_autocorr: d.signal_autocorr,
  }
}
