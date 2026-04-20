/**
 * Simple-identity helper — no email, no password.
 *
 * We derive a stable UUID from (fullName, dob) via SHA-256 so the same
 * (name, DOB) pair always resolves to the same Supabase row across devices.
 * Identity lives in localStorage so the user doesn't re-enter it on every
 * visit.
 */

const STORE_KEY = 'signaltracer_user_v1'

export interface LocalUser {
  id: string
  fullName: string
  dob: string // ISO yyyy-mm-dd
}

export function readUser(): LocalUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORE_KEY)
    return raw ? (JSON.parse(raw) as LocalUser) : null
  } catch {
    return null
  }
}

export function writeUser(u: LocalUser): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(u))
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearUser(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Shape 32 hex chars into the canonical 8-4-4-4-12 UUID form.
 */
function hexToUuid(hex: string): string {
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20, 32)
  )
}

/**
 * Normalise inputs so "Jane Doe" and "jane  doe " both hash to the same id.
 */
function normalize(fullName: string, dob: string): string {
  const name = fullName.trim().toLowerCase().replace(/\s+/g, ' ')
  return `signaltracer|${name}|${dob.trim()}`
}

/**
 * Deterministic UUID from (fullName, dob). UUID v5 style (namespaced hash).
 */
export async function deriveUserId(
  fullName: string,
  dob: string
): Promise<string> {
  const input = normalize(fullName, dob)
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hexToUuid(hex.slice(0, 32))
}
