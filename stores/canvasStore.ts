import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import type { NodeChange, EdgeChange } from '@xyflow/react'
import type { CanvasNode, CanvasEdge, BlockStatus, NodeData } from '@/types'

interface CanvasStore {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeId: string | null
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
  clear: () => void
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,

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

  clear: () => set({ nodes: [], edges: [], selectedNodeId: null }),
}))
