'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { Canvas } from '@/components/canvas/Canvas'
import { BlockPalette } from '@/components/canvas/BlockPalette'
import { Inspector } from '@/components/canvas/Inspector'
import { BottomDrawer } from '@/components/canvas/BottomDrawer'
import { CopilotPanel } from '@/components/copilot/CopilotPanel'
import { useCanvasStore } from '@/stores/canvasStore'
import { fetchProject, saveProject } from '@/lib/api/placeholders'
import { MOCK_CANVAS_MESSAGES } from '@/lib/mocks/mockMessages'
import type { PageContext, PipelineGraph } from '@/types'
import { Play, ChevronLeft, Loader2, Check } from 'lucide-react'

export default function CanvasPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { nodes, edges, setNodes, setEdges, setStatuses } = useCanvasStore()
  const [projectName, setProjectName] = useState('Untitled')
  const [isRunning, setIsRunning] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    fetchProject(id)
      .then((proj) => {
        setProjectName(proj.name)
        if (proj.graph) {
          setNodes(proj.graph.nodes)
          setEdges(proj.graph.edges)
        }
      })
      .catch(() => {
        // Project not found in Supabase (e.g. bookmarked stale ID). Stay on empty canvas.
        setProjectName('Untitled')
      })
    return () => useCanvasStore.getState().clear()
  }, [id, setNodes, setEdges])

  const handleSave = useCallback(async () => {
    setSaveState('saving')
    try {
      await saveProject({ id, name: projectName, graph: { nodes, edges } })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2500)
    }
  }, [id, projectName, nodes, edges])

  const handleRun = useCallback(() => {
    if (nodes.length === 0) return
    setIsRunning(true)
    const runningStatuses = Object.fromEntries(
      nodes.map((n) => [n.id, 'running' as const])
    )
    setStatuses(runningStatuses)
    nodes.forEach((n, i) => {
      setTimeout(() => {
        setStatuses({ [n.id]: 'success' })
      }, 280 * (i + 1))
    })
    setTimeout(() => setIsRunning(false), 280 * (nodes.length + 1))
  }, [nodes, setStatuses])

  const handlePipelineGenerated = useCallback(
    (graph: PipelineGraph) => {
      setNodes(graph.nodes)
      setEdges(graph.edges)
    },
    [setNodes, setEdges]
  )

  const isCopilotSuggested = nodes.some((n) => n.data.source === 'copilot')
  const ctx: PageContext = {
    page: 'canvas',
    projectId: id,
    projectName,
    blockCount: nodes.length,
  }

  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-11 bg-bg-1 border-b border-eq-border flex-shrink-0 text-[12px]">
          <span className="font-medium text-eq-t1">{projectName}</span>
          <span className="text-eq-t3">/</span>
          <span className="text-[11px] text-eq-t3">
            {nodes.length} blocks{isCopilotSuggested ? ' · gemini-suggested' : ''} ·{' '}
            {isRunning ? 'running…' : 'not yet run'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push('/projects')}
              className="flex items-center gap-1 px-2.5 py-1 bg-bg-3 text-eq-t2 border border-eq-border rounded text-[11px] hover:text-eq-t1 transition-colors"
            >
              <ChevronLeft size={12} /> Projects
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className={`flex items-center gap-1 px-2.5 py-1 border rounded text-[11px] transition-colors disabled:opacity-60 ${
                saveState === 'saved'
                  ? 'bg-eq-green-dim text-eq-green border-eq-green/30'
                  : saveState === 'error'
                  ? 'bg-eq-red-dim text-eq-red border-eq-red/30'
                  : 'bg-bg-3 text-eq-t2 border-eq-border hover:text-eq-t1'
              }`}
            >
              {saveState === 'saving' ? (
                <><Loader2 size={11} className="animate-spin" /> Saving…</>
              ) : saveState === 'saved' ? (
                <><Check size={11} /> Saved</>
              ) : saveState === 'error' ? (
                'Save failed'
              ) : (
                'Save'
              )}
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning || nodes.length === 0}
              className="flex items-center gap-1.5 px-4 py-1 bg-eq-green text-[#0a1a12] rounded text-[12px] font-semibold hover:brightness-110 disabled:opacity-50 transition"
            >
              <Play size={12} /> {isRunning ? 'Running…' : 'Run'}
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[145px_1fr_180px] overflow-hidden min-h-0">
          <BlockPalette />
          <Canvas />
          <Inspector />
          <CopilotPanel
            pageContext={ctx}
            initialMessages={MOCK_CANVAS_MESSAGES}
            onPipelineGenerated={handlePipelineGenerated}
            subtitle="gemini-2.0-flash · agent"
          />
        </div>

        <BottomDrawer />
      </div>
    </AppShell>
  )
}
