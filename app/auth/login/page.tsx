'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, Lock, Sparkles } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const next = search.get('next') ?? '/projects'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

  const supabase = createClient()

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
    else router.replace(next)
  }

  const handleMagicLink = async () => {
    if (!email) {
      setError('Enter your email first')
      return
    }
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (error) setError(error.message)
    else setMagicSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-0 p-6">
      <div className="w-full max-w-sm bg-bg-1 border border-eq-border rounded-xl p-7">
        <div className="mb-6">
          <div className="text-[18px] font-semibold text-eq-t1 tracking-tight">
            Ez<span className="text-gemini">Quant</span>
          </div>
          <div className="text-[11px] text-eq-t2 mt-1">Sign in to your workspace</div>
        </div>

        {magicSent ? (
          <div className="text-[12px] text-eq-green bg-eq-green-dim border border-eq-green/25 rounded-md p-3 flex items-start gap-2">
            <Sparkles size={14} className="flex-shrink-0 mt-px" />
            <div>
              Magic link sent to <span className="font-mono">{email}</span>. Click it to finish
              signing in.
            </div>
          </div>
        ) : (
          <form onSubmit={handlePasswordLogin} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-eq-t3 uppercase tracking-wider">Email</span>
              <div className="relative">
                <Mail
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-eq-t3"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-7 pr-3 py-2 bg-bg-3 border border-eq-border text-eq-t1 text-[12px] rounded outline-none focus:border-eq-accent font-sans"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-eq-t3 uppercase tracking-wider">Password</span>
              <div className="relative">
                <Lock
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-eq-t3"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-7 pr-3 py-2 bg-bg-3 border border-eq-border text-eq-t1 text-[12px] rounded outline-none focus:border-eq-accent font-sans"
                />
              </div>
            </label>

            {error && (
              <div className="text-[11px] text-eq-red bg-eq-red-dim border border-eq-red/25 rounded px-2 py-1.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-eq-accent hover:bg-eq-accent-2 text-white text-[12px] font-medium py-2 rounded disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : null}
              Sign in
            </button>

            <div className="flex items-center gap-2 my-1">
              <div className="flex-1 h-px bg-eq-border" />
              <span className="text-[9px] font-mono text-eq-t3 uppercase">or</span>
              <div className="flex-1 h-px bg-eq-border" />
            </div>

            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="bg-bg-3 hover:bg-bg-4 border border-eq-border-2 text-eq-t1 text-[12px] font-medium py-2 rounded disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Sparkles size={12} /> Email magic link
            </button>
          </form>
        )}

        <div className="mt-5 text-center text-[11px] text-eq-t3">
          No account?{' '}
          <Link href="/auth/signup" className="text-eq-accent hover:text-eq-t1">
            Sign up
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-0" />}>
      <LoginForm />
    </Suspense>
  )
}
