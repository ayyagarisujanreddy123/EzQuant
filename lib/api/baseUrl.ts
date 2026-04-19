/**
 * Resolve the base URL for the FastAPI backend.
 *
 * Priority:
 *   1. `NEXT_PUBLIC_BACKEND_URL` — explicit override (useful for staging or
 *      when the backend lives on a different origin). Must be a full URL.
 *   2. Same-origin `/_/backend` — matches the `vercel.json` route that
 *      proxies the backend service. Avoids CORS + mixed-content issues
 *      entirely and needs zero config in production.
 *   3. `http://localhost:8000` — dev fallback when not in the browser at
 *      all (SSR / build time) and during local `npm run dev`.
 *
 * Important: never return a relative path on the server — `fetch()` can't
 * resolve it. We only switch to `/_/backend` when we know we're running in
 * the browser with a real `window.location`.
 */
const ENV_URL = process.env.NEXT_PUBLIC_BACKEND_URL
const LOCAL_DEV = 'http://localhost:8000'
const VERCEL_BACKEND_PATH = '/_/backend'

export function resolveBackendUrl(): string {
  if (ENV_URL && ENV_URL.trim()) return ENV_URL.trim().replace(/\/$/, '')
  if (typeof window === 'undefined') return LOCAL_DEV
  const host = window.location.hostname
  const isLocalHost = host === 'localhost' || host === '127.0.0.1'
  return isLocalHost ? LOCAL_DEV : VERCEL_BACKEND_PATH
}
