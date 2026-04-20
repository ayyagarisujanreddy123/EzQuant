import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth gate DISABLED — using simple-identity mode (name + DOB → hashed UUID
 * stored in localStorage). Every route is public at the edge; the AppShell
 * enforces the identity check client-side and redirects to `/enter` if no
 * identity is present.
 */
export async function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
