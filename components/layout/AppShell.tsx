'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TABS = [
  { label: 'Projects', href: '/projects' },
  { label: 'Canvas', href: '/canvas' },
  { label: 'Templates', href: '/gallery' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  }, [])

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
          Signal<span className="text-gemini">Tracer</span>
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
          <button
            type="button"
            onClick={() =>
              document.dispatchEvent(new CustomEvent('toggle-copilot'))
            }
            className="flex items-center gap-1.5 px-2.5 py-1 bg-eq-accent-dim text-eq-accent border border-eq-accent/25 rounded-md text-[11px] font-medium hover:bg-eq-accent/20 transition-colors"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-eq-cyan" />
            Bloom
          </button>
          {email && (
            <span
              className="text-[10px] font-mono text-eq-t3 max-w-[140px] truncate"
              title={email}
            >
              {email}
            </span>
          )}
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              title="Sign out"
              className="flex items-center gap-1 px-2 py-1 bg-bg-2 text-eq-t2 border border-eq-border hover:bg-eq-red-dim hover:text-eq-red hover:border-eq-red/30 rounded-md text-[11px] font-medium transition-colors"
            >
              <LogOut size={11} />
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  )
}
