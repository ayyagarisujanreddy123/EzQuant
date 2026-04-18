'use client'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { CopilotPanel } from '@/components/copilot/CopilotPanel'
import { MOCK_TEMPLATES } from '@/lib/mocks/mockTemplates'
import { MOCK_GALLERY_MESSAGES } from '@/lib/mocks/mockMessages'
import type { PageContext } from '@/types'

interface MiniNode {
  label: string
  color: string
  left: number
  top: number
}

const MINI_NODES: Record<string, MiniNode[]> = {
  'tpl-mom': [
    { label: 'Ticker AAPL', color: 'border-l-eq-blue', left: 6, top: 18 },
    { label: 'Log Returns', color: 'border-l-eq-amber', left: 90, top: 46 },
    { label: 'EMA-20', color: 'border-l-eq-accent', left: 158, top: 18 },
    { label: 'Backtest', color: 'border-l-eq-green', left: 210, top: 46 },
  ],
  'tpl-pairs': [
    { label: 'SPY', color: 'border-l-eq-blue', left: 4, top: 10 },
    { label: 'QQQ', color: 'border-l-eq-blue', left: 4, top: 68 },
    { label: 'Roll Corr', color: 'border-l-eq-accent', left: 115, top: 40 },
    { label: 'Backtest', color: 'border-l-eq-green', left: 215, top: 40 },
  ],
  'tpl-vol': [
    { label: 'Ticker', color: 'border-l-eq-blue', left: 4, top: 14 },
    { label: 'Log Ret', color: 'border-l-eq-amber', left: 4, top: 62 },
    { label: 'Volatility', color: 'border-l-eq-accent', left: 100, top: 30 },
    { label: 'Momentum', color: 'border-l-eq-accent', left: 100, top: 72 },
    { label: 'Backtest', color: 'border-l-eq-green', left: 200, top: 48 },
  ],
}

export default function GalleryPage() {
  const router = useRouter()
  const ctx: PageContext = {
    page: 'gallery',
    templateCount: MOCK_TEMPLATES.length,
  }

  return (
    <AppShell>
      <div className="h-full grid grid-cols-[1fr_320px] overflow-hidden">
        <div className="overflow-y-auto p-6">
          <div className="mb-5">
            <h1 className="text-[17px] font-medium text-eq-t1">Template Gallery</h1>
            <p className="text-[12px] text-eq-t2 mt-0.5">
              Pre-wired pipelines — or ask Copilot to generate one
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => router.push(`/canvas/${tpl.id}`)}
                className="bg-bg-2 border border-eq-border rounded-[10px] overflow-hidden cursor-pointer hover:border-eq-accent transition-all"
              >
                <div className="h-[110px] relative bg-bg-1 p-2 overflow-hidden">
                  {MINI_NODES[tpl.id]?.map((n, i) => (
                    <div
                      key={i}
                      style={{ left: n.left, top: n.top }}
                      className={`absolute bg-bg-3 border-l-2 ${n.color} border border-eq-border-2 rounded px-1.5 py-0.5 text-[8px] font-mono text-eq-t2 whitespace-nowrap`}
                    >
                      {n.label}
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-eq-border">
                  <div className="text-[12px] font-medium text-eq-t1 mb-1">{tpl.name}</div>
                  <div className="text-[10px] text-eq-t2 leading-relaxed mb-1.5">
                    {tpl.description}
                  </div>
                  <div className="flex gap-2.5 text-[9px] font-mono">
                    <span>
                      <span className="text-eq-t3">Sharpe </span>
                      <span className="text-eq-green font-medium">{tpl.sharpe}</span>
                    </span>
                    <span className="text-eq-t3">{tpl.blockCount} blocks</span>
                  </div>
                </div>
              </div>
            ))}

            <div
              onClick={() =>
                document.dispatchEvent(new CustomEvent('focus-composer'))
              }
              className="bg-gradient-to-br from-eq-accent/5 to-eq-cyan/5 border border-eq-cyan rounded-[10px] overflow-hidden cursor-pointer hover:border-eq-cyan/60 transition-all"
            >
              <div className="h-[110px] flex items-center justify-center bg-bg-1">
                <div className="text-center">
                  <div className="text-[22px] mb-1 text-gemini">✦</div>
                  <div className="text-[11px] text-eq-cyan">Generate with Copilot</div>
                </div>
              </div>
              <div className="p-3 border-t border-eq-border">
                <div className="text-[12px] font-medium text-eq-t1 mb-1">
                  Describe your strategy
                </div>
                <div className="text-[10px] text-eq-t2 leading-relaxed mb-1.5">
                  Tell Copilot what you want — it&apos;ll build the pipeline for you.
                </div>
                <div className="text-[9px] font-mono text-eq-t3">Powered by Gemini</div>
              </div>
            </div>
          </div>
        </div>
        <CopilotPanel
          pageContext={ctx}
          initialMessages={MOCK_GALLERY_MESSAGES}
          subtitle="gemini-2.0-flash · multimodal"
        />
      </div>
    </AppShell>
  )
}
