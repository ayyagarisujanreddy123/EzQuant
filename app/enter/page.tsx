'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Loader2, ArrowRight } from 'lucide-react'
import { deriveUserId, readUser, writeUser } from '@/lib/user'
import { resolveBackendUrl } from '@/lib/api/baseUrl'

export default function EnterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/projects'

  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already identified? Skip the form.
  useEffect(() => {
    const existing = readUser()
    if (existing) router.replace(next)
  }, [router, next])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) {
      setError('Enter your full name.')
      return
    }
    if (!dob) {
      setError('Select your date of birth.')
      return
    }
    setLoading(true)
    try {
      const id = await deriveUserId(fullName, dob)
      // Best-effort upsert — if the simple_users table isn't migrated yet
      // we still save locally and let the user into the app. Projects will
      // persist as long as the projects table is reachable.
      try {
        await fetch(`${resolveBackendUrl()}/api/simple/user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: id,
            full_name: fullName.trim(),
            dob,
          }),
        })
      } catch {
        /* offline-friendly — continue */
      }
      writeUser({ id, fullName: fullName.trim(), dob })
      router.replace(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not derive user id.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-0 p-6">
      <div className="w-full max-w-sm bg-bg-1 border border-eq-border rounded-xl p-7 shadow-xl shadow-black/40">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={15} className="text-eq-cyan" />
          <div className="text-[16px] font-semibold text-eq-t1 tracking-tight">
            Signal<span className="text-gemini">Tracer</span>
          </div>
        </div>
        <div className="text-[12.5px] text-eq-t1 font-medium mb-1">Enter the app</div>
        <div className="text-[11px] text-eq-t2 leading-relaxed mb-5">
          No email, no password. Your full name + date of birth are hashed into
          a stable ID so your pipelines come back on any device.
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-eq-t3 uppercase tracking-wider">
              Full Name
            </span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              autoComplete="name"
              required
              className="px-3 py-2 bg-bg-3 border border-eq-border text-eq-t1 text-[12px] rounded outline-none focus:border-eq-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-eq-t3 uppercase tracking-wider">
              Date of Birth
            </span>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
              max={new Date().toISOString().slice(0, 10)}
              className="px-3 py-2 bg-bg-3 border border-eq-border text-eq-t1 text-[12px] rounded outline-none focus:border-eq-accent"
            />
          </label>

          {error && (
            <div className="text-[11px] text-eq-red bg-eq-red-dim border border-eq-red/25 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-eq-accent hover:bg-eq-accent-2 text-white text-[12px] font-medium py-2 rounded disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <ArrowRight size={12} />
            )}
            {loading ? 'Entering…' : 'Enter SignalTracer'}
          </button>
        </form>

        <div className="mt-4 text-[10px] text-eq-t3 leading-relaxed">
          Your pipelines persist in Supabase keyed by this hash. No authentication
          is enforced in this mode — anyone with the same name + DOB lands on the
          same workspace.
        </div>
      </div>
    </div>
  )
}
