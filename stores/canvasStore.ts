import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { NodeChange, EdgeChange } from '@xyflow/react'
import type {
  CanvasNode,
  CanvasEdge,
  BlockStatus,
  NodeData,
  NodeRunResult,
} from '@/types'

interface CanvasStore {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeId: string | null

  /** Last persisted run (full Run button click). */
  runId: string | null
  /** Latest per-node results from /api/pipeline/run (Run or Evaluate). */
  lastRunResults: Record<string, NodeRunResult>
  /** True while a Run or Evaluate is in flight. */
  isRunning: boolean

  setNodes: (nodes: CanvasNode[]) => void
  setEdges: (edges: CanvasEdge[]) => void
  addNodes: (nodes: CanvasNode[]) => void
  addEdges: (edges: CanvasEdge[]) => void
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void
  setSelected: (id: string | null) => void
  setStatuses: (statuses: Record<string, BlockStatus>) => void
  updateParam: (nodeId: string, key: string, value: string | number | boolean) => void
  patchNodeData: (nodeId: string, patch: Partial<NodeData>) => void

  setIsRunning: (running: boolean) => void
  setRunId: (id: string | null) => void
  applyRunResults: (results: Record<string, NodeRunResult>) => void
  clearRunResults: () => void

  clear: () => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  runId: null,
  lastRunResults: {},
  isRunning: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  addNodes: (n) => set((s) => ({ nodes: [...s.nodes, ...n] })),
  addEdges: (e) => set((s) => ({ edges: [...s.edges, ...e] })),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  setSelected: (id) => set({ selectedNodeId: id }),

  setStatuses: (statuses) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        statuses[n.id] ? { ...n, data: { ...n.data, status: statuses[n.id] } } : n
      ),
    })),

  updateParam: (nodeId, key, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
          : n
      ),
    })),

  patchNodeData: (nodeId, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    })),

  setIsRunning: (running) => set({ isRunning: running }),
  setRunId: (id) => set({ runId: id }),

  /**
   * Apply RunResponse.node_results:
   *  - update each node's status
   *  - stash diagnostics/metrics/quality on node.data for Inspector to read
   *  - keep full result in lastRunResults for Data tab df_preview + CSV export
   */
  applyRunResults: (results) =>
    set((s) => ({
      lastRunResults: { ...s.lastRunResults, ...results },
      nodes: s.nodes.map((n) => {
        const r = results[n.id]
        if (!r) return n
        return {
          ...n,
          data: {
            ...n.data,
            status: r.status,
            quality: r.quality ?? n.data.quality,
            metrics: r.metrics ?? n.data.metrics,
            diagnostics: r.diagnostics ?? n.data.diagnostics,
            fetchError: r.error,
            lastResult: r,
          },
        }
      }),
    })),

  clearRunResults: () => set({ lastRunResults: {}, runId: null }),

  clear: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      runId: null,
      lastRunResults: {},
      isRunning: false,
    }),
}))
