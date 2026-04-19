'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, Lock, CheckCircle2 } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { display_name: displayName || email.split('@')[0] },
      },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    // If confirmation email is required, session is null here
    if (data.session) {
      router.replace('/projects')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-0 p-6">
      <div className="w-full max-w-sm bg-bg-1 border border-eq-border rounded-xl p-7">
        <div className="mb-6">
          <div className="text-[18px] font-semibold text-eq-t1 tracking-tight">
            Ez<span className="text-gemini">Quant</span>
          </div>
          <div className="text-[11px] text-eq-t2 mt-1">Create your account</div>
        </div>

        {sent ? (
          <div className="text-[12px] text-eq-green bg-eq-green-dim border border-eq-green/25 rounded-md p-3 flex items-start gap-2">
            <CheckCircle2 size={14} className="flex-shrink-0 mt-px" />
            <div>
              Check <span className="font-mono">{email}</span> for a confirmation link.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-eq-t3 uppercase tracking-wider">Display Name</span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Sujan"
                className="px-3 py-2 bg-bg-3 border border-eq-border text-eq-t1 text-[12px] rounded outline-none focus:border-eq-accent"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-eq-t3 uppercase tracking-wider">Email</span>
              <div className="relative">
                <Mail size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-eq-t3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-7 pr-3 py-2 bg-bg-3 border border-eq-border text-eq-t1 text-[12px] rounded outline-none focus:border-eq-accent"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-eq-t3 uppercase tracking-wider">Password</span>
              <div className="relative">
                <Lock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-eq-t3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  className="w-full pl-7 pr-3 py-2 bg-bg-3 border border-eq-border text-eq-t1 text-[12px] rounded outline-none focus:border-eq-accent"
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
              Create account
            </button>
          </form>
        )}

        <div className="mt-5 text-center text-[11px] text-eq-t3">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-eq-accent hover:text-eq-t1">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
