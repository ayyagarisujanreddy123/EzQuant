import type { Node, Edge } from '@xyflow/react'

// ── Block / Catalog ──────────────────────────────────────────────────────────
export type BlockCategory = 'data' | 'clean' | 'signal' | 'model' | 'eval'

export type BlockType =
  | 'ticker_source' | 'csv_upload'
  | 'drop_na' | 'log_returns' | 'resample' | 'z_score'
  | 'ema' | 'ems' | 'momentum' | 'rolling_corr'
  | 'linear_reg' | 'threshold_signal'
  | 'backtest' | 'equity_curve'

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
  sharpe: number
  maxDrawdown: number
  totalReturn: number
  annualizedReturn: number
  winRate?: number
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
  bars?: OhlcvBar[]
  fetchError?: string
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

export interface Message {
  id: string
  role: MessageRole
  content?: string
  toolCalls?: ToolCall[]
  citations?: Citation[]
  appliedTemplate?: boolean
  attachmentNote?: string
  timestamp: Date
}

export type CopilotEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; summary: string }
  | { type: 'tool_result'; tool: string; summary: string }
  | { type: 'citations'; citations: Citation[] }
  | { type: 'applied_banner' }
  | { type: 'suggest_pipeline_template'; graph: PipelineGraph }
  | { type: 'done' }

export interface PageContext {
  page: 'projects' | 'canvas' | 'gallery'
  projectId?: string
  projectName?: string
  blockCount?: number
  savedProjectCount?: number
  templateCount?: number
}
