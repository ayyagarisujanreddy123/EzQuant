'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { CopilotPanel } from '@/components/copilot/CopilotPanel'
import { fetchProjects, createProject } from '@/lib/api/placeholders'
import { MOCK_TEMPLATES } from '@/lib/mocks/mockTemplates'
import { MOCK_PROJECTS_MESSAGES } from '@/lib/mocks/mockMessages'
import type { Project, PageContext, Template } from '@/types'
import { Loader2 } from 'lucide-react'

const ACCENT_BAR: Record<string, string> = {
  green: 'bg-eq-green',
  blue: 'bg-eq-blue',
  amber: 'bg-eq-amber',
}
const ACCENT_BADGE: Record<string, string> = {
  green: 'bg-eq-green-dim text-eq-green',
  blue: 'bg-eq-blue-dim text-eq-blue',
  amber: 'bg-eq-amber-dim text-eq-amber',
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [])

  const handleNewPipeline = async (input?: { name?: string; template?: Template }) => {
    setCreating(true)
    try {
      const project = await createProject({
        name: input?.name ?? input?.template?.name ?? 'Untitled pipeline',
        graph: input?.template?.graph,
      })
      router.push(`/canvas/${project.id}`)
    } catch (err) {
      console.error(err)
      setCreating(false)
    }
  }

  const ctx: PageContext = {
    page: 'projects',
    savedProjectCount: projects.length,
  }

  return (
    <AppShell>
      <div className="h-full overflow-hidden">
        <div className="h-full overflow-y-auto p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-[17px] font-medium text-eq-t1">Research Projects</h1>
              <p className="text-[12px] text-eq-t2 mt-0.5">Your saved pipelines</p>
            </div>
            <button
              type="button"
              onClick={() => handleNewPipeline()}
              disabled={creating}
              className="flex items-center gap-1.5 bg-eq-accent text-white border-none px-3.5 py-1.5 rounded-[7px] text-[12px] font-medium hover:bg-eq-accent-2 disabled:opacity-60 transition-colors"
            >
              {creating ? <Loader2 size={12} className="animate-spin" /> : null}
              + New Pipeline
            </button>
          </div>

          <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-[0.8px] mb-2.5">
            Quick start — templates
          </div>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {MOCK_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => handleNewPipeline({ template: tpl })}
                className="relative bg-bg-2 border border-eq-border rounded-[10px] p-3.5 cursor-pointer hover:border-eq-border-2 hover:bg-bg-3 transition-all overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-0.5 ${ACCENT_BAR[tpl.accentColor]}`}
                />
                <div className="text-base mb-1.5">{tpl.icon}</div>
                <div className="text-[12px] font-medium text-eq-t1 mb-1">{tpl.name}</div>
                <div className="text-[10px] text-eq-t2 leading-relaxed mb-1.5">
                  {tpl.description}
                </div>
                <span
                  className={`inline-block text-[9px] font-mono px-1.5 py-0.5 rounded ${ACCENT_BADGE[tpl.accentColor]}`}
                >
                  Sharpe {tpl.sharpe}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[10px] font-medium text-eq-t3 uppercase tracking-[0.8px] mb-2.5">
            Saved projects
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => router.push(`/canvas/${proj.id}`)}
                className="bg-bg-2 border border-eq-border rounded-[10px] p-3.5 cursor-pointer hover:border-eq-accent transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-medium text-eq-t1">{proj.name}</span>
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      proj.status === 'healthy' ? 'bg-eq-green' : 'bg-eq-amber'
                    }`}
                  />
                </div>
                <div
                  className={`text-[19px] font-light font-mono mt-1.5 ${
                    proj.sharpe < 0 ? 'text-eq-red' : 'text-eq-green'
                  }`}
                >
                  {proj.sharpe}
                </div>
                <div className="text-[9px] text-eq-t3 mb-2">Sharpe</div>
                <div className="flex items-center justify-between pt-2 border-t border-eq-border">
                  <span className="text-[10px] text-eq-t2 font-mono">
                    {proj.blockCount} blocks
                  </span>
                  <span className="text-[9px] text-eq-t3">{proj.updatedAt}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <CopilotPanel
          pageContext={ctx}
          initialMessages={MOCK_PROJECTS_MESSAGES}
          subtitle="gemini-2.0-flash · rag"
        />
      </div>
    </AppShell>
  )
}
