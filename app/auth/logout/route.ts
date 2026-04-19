import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function signOut(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const url = new URL('/', request.url)
  return NextResponse.redirect(url, 303)
}

export const GET = signOut
export const POST = signOut
