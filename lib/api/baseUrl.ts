/**
 * Resolve the base URL for the FastAPI backend at request time.
 *
 * Priority:
 *   1. `NEXT_PUBLIC_BACKEND_URL` — explicit override (full URL). Useful for
 *      pointing staging at a standalone backend origin.
 *   2. Same-origin `/_/backend` — matches the experimental backend route
 *      declared in vercel.json, so no CORS and no mixed-content issues in
 *      production with zero extra config.
 *   3. `http://localhost:8000` — dev fallback for SSR / build time and the
 *      local `npm run dev` flow.
 *
 * We only return a relative path when we know we're running in the browser
 * — `fetch()` can't resolve a relative URL on the server side.
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
