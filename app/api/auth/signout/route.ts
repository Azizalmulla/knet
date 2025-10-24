import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  const requestUrl = new URL(request.url)
  const supabase = createServerClient()

  await supabase.auth.signOut()

  return NextResponse.redirect(new URL('/student/login', requestUrl.origin), {
    status: 301,
  })
}
