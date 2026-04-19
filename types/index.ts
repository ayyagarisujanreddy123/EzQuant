import type { Node, Edge } from '@xyflow/react'

// ── Block / Catalog ──────────────────────────────────────────────────────────
export type BlockCategory = 'data' | 'clean' | 'signal' | 'model' | 'eval'

export type BlockType =
  // MVP — each name matches backend/blocks/BLOCK_REGISTRY
  | 'universe' | 'csv_upload'
  | 'log_returns' | 'forward_return'
  | 'ema' | 'momentum'
  | 'signal' | 'signal_diagnostics'
  | 'position_sizer'
  | 'backtest'
  // Stretch — frontend-only. BlockPalette renders ghosted; backend refuses
  // to execute them at run time.
  | 'drop_na' | 'resample' | 'z_score'
  | 'ems' | 'rolling_corr' | 'linear_reg'
  | 'equity_curve'

export type BlockStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped'

export interface ParamSchema {
  key: string
  label: string
  type: 'string' | 'number' | 'select' | 'boolean'
  default: string | number | boolean
  options?: string[]
  placeholder?: string
}

export interface BlockDefinition {
  type: BlockType
  category: BlockCategory
  label: string
  description?: string
  stretch?: boolean
  paramsSchema: ParamSchema[]
  /** Named input ports in the order the backend expects them. */
  inputPorts: string[]
}

// ── Node Data ────────────────────────────────────────────────────────────────
export interface DataQuality {
  rows: number
  dateRange: string
  missing: number
  nanCount: number
  lookaheadRisk: boolean
  sparkline?: number[]
}

export interface Metrics {
  sharpe?: number
  maxDrawdown?: number
  max_drawdown?: number
  totalReturn?: number
  total_return?: number
  annualizedReturn?: number
  winRate?: number
  hit_rate?: number
  n_trades?: number
  avg_holding_period?: number
}

/** signal_diagnostics output — surfaced in Inspector Eval tab. */
export interface Diagnostics {
  ic: number
  ic_tstat: number
  n: number
  ic_decay: Record<string, number>           // {"1": 0.05, "5": 0.02, ...}
  ic_stability: Record<string, number>       // {"2023-01": 0.08, ...}
  signal_autocorr: number
}

/** Per-node result the backend ships back for Inspector to render. */
export interface NodeRunResult {
  node_id: string
  status: BlockStatus
  error?: string
  df_preview?: { columns: string[]; rows: unknown[][]; shape: [number, number] }
  shape?: [number, number]
  quality?: DataQuality
  metrics?: Metrics
  diagnostics?: Diagnostics
  metadata?: Record<string, unknown>
}

export interface RunResponse {
  run_id?: string | null
  status: 'running' | 'success' | 'error'
  statuses: Record<string, BlockStatus>
  node_results: Record<string, NodeRunResult>
  errors: Record<string, string>
  started_at: string
  completed_at?: string
  summary?: Record<string, unknown> | null
}

export interface NodeData extends Record<string, unknown> {
  id: string
  name: string
  category: BlockCategory
  status: BlockStatus
  source?: 'user' | 'copilot'
  blockType: BlockType
  params: Record<string, string | number | boolean>
  quality?: DataQuality
  metrics?: Metrics
  diagnostics?: Diagnostics
  bars?: OhlcvBar[]
  fetchError?: string
  lastResult?: NodeRunResult
  /** True when node is a copilot suggestion awaiting user approval. */
  pending?: boolean
}

export interface OhlcvBar {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  adj_close: number
}

export interface EdgeData extends Record<string, unknown> {
  label?: string
  /** Named input port on the target node (e.g. "signal_df"). Defaults to "df". */
  targetPort?: string
}

export type CanvasNode = Node<NodeData, BlockType>
export type CanvasEdge = Edge<EdgeData>

export interface PipelineGraph {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface RunResult {
  success: boolean
  metrics?: Metrics
  error?: string
  nodeStatuses: Record<string, BlockStatus>
}

// ── Projects / Templates ─────────────────────────────────────────────────────
export interface Project {
  id: string
  name: string
  sharpe: number
  blockCount: number
  status: 'healthy' | 'warning'
  updatedAt: string
  graph?: PipelineGraph
}

export type TemplateAccent = 'green' | 'blue' | 'amber'

export interface Template {
  id: string
  name: string
  description: string
  accentColor: TemplateAccent
  icon: string
  sharpe: number
  blockCount: number
  graph: PipelineGraph
}

// ── Copilot / Chat ───────────────────────────────────────────────────────────
export type MessageRole = 'user' | 'agent' | 'system'
export type CopilotMode = 'ask' | 'suggest' | 'debug'

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'pdf' | 'csv' | 'other'
  file?: File
}

export interface ToolCall {
  tool: string
  summary: string
  status: 'running' | 'done' | 'error'
}

export interface Citation {
  num: number
  source: string
  url?: string
}

export interface GeneratedImage {
  mime: string
  data_b64: string
}

export interface Message {
  id: string
  role: MessageRole
  content?: string
  toolCalls?: ToolCall[]
  citations?: Citation[]
  appliedTemplate?: boolean
  attachmentNote?: string
  images?: GeneratedImage[]
  timestamp: Date
}

/** Enriched template payload emitted by the agent's suggest_pipeline_template tool. */
export interface PipelineTemplate {
  name: string
  description: string
  rationale?: string
  graph: PipelineGraph
}

export type CopilotEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; summary: string; status?: 'running' | 'done' }
  | { type: 'tool_result'; tool: string; summary: string }
  | { type: 'citations'; citations?: Citation[]; sources?: Citation[] }
  | { type: 'applied_banner' }
  | { type: 'suggest_pipeline_template'; graph: PipelineGraph }
  | { type: 'pipeline_template'; template: PipelineTemplate }
  | { type: 'image'; mime: string; data_b64: string }
  | { type: 'done' }

export interface PageContext {
  page: 'projects' | 'canvas' | 'gallery'
  projectId?: string
  projectName?: string
  blockCount?: number
  savedProjectCount?: number
  templateCount?: number
}
