import { NextRequest, NextResponse } from 'next/server'
import { getDbInfo } from '@/lib/db'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ ok: false, error: 'Not available in production' }, { status: 404 })
  }

  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}

  const { host: dbHost, db: dbName } = getDbInfo()
  const url = new URL(req.url)
  const info = {
    ok: true,
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: {
      'x-org-slug': req.headers.get('x-org-slug') || null,
      'x-org-id': req.headers.get('x-org-id') || null,
      'user-agent': req.headers.get('user-agent') || null,
    },
    db: { host: dbHost, name: dbName },
    user: { email: emailLower }
  }
  const res = NextResponse.json(info, { headers: { 'Cache-Control': 'no-store' } })
  res.headers.set('X-DB-Host', dbHost)
  res.headers.set('X-DB-Name', dbName)
  if (emailLower) res.headers.set('X-User-Email', emailLower)
  res.headers.set('X-Org-Slug', req.headers.get('x-org-slug') || '')
  res.headers.set('X-Org-Id', req.headers.get('x-org-id') || '')
  return res
}
