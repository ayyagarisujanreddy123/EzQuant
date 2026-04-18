'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Projects', href: '/projects' },
  { label: 'Canvas', href: '/canvas' },
  { label: 'Templates', href: '/gallery' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('focus-composer'))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-bg-0 overflow-hidden">
      <nav className="flex items-center gap-1 px-4 py-2.5 bg-bg-1 border-b border-eq-border flex-shrink-0">
        <span className="text-[13px] font-semibold text-eq-t1 mr-4 tracking-tight">
          Ez<span className="text-gemini">Quant</span>
        </span>
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all ${
              pathname.startsWith(tab.href)
                ? 'text-eq-t1 bg-bg-3 border border-eq-border-2'
                : 'text-eq-t2 hover:text-eq-t1 hover:bg-bg-3 border border-transparent'
            }`}
          >
            {tab.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-eq-t3 font-mono px-1.5 py-0.5 border border-eq-border-2 rounded bg-bg-2">
            ⌘K
          </span>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-eq-accent-dim text-eq-accent border border-eq-accent/25 rounded-md text-[11px] font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan" />
            Quant Copilot
          </div>
        </div>
      </nav>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
