import { NextRequest, NextResponse } from 'next/server'
import { sql, getDbInfo } from '@/lib/db'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  // Dev-only endpoint
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ ok: false, error: 'Not available in production' }, { status: 404 })
  }

  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}
  if (!emailLower) {
    return NextResponse.json({ ok: false, error: 'Not logged in' }, { status: 401 })
  }

  const { host: dbHost, db: dbName } = getDbInfo()

  try {
    const rowsAll = await sql`
      SELECT 
        c.id::text,
        c.full_name,
        c.email,
        COALESCE(c.created_at, NOW()) AS created_at,
        COALESCE(o.slug, '') AS org_slug,
        COALESCE(o.name, o.slug) AS org_name,
        c.parse_status::text AS parse_status,
        c.cv_type::text AS cv_type
      FROM public.candidates c
      LEFT JOIN organizations o ON o.id = c.org_id
      WHERE c.email_lc = ${emailLower}
        AND COALESCE(c.deleted_at, NULL) IS NULL
      ORDER BY c.created_at DESC NULLS LAST
      LIMIT 5
    `

    const countRes = await sql`SELECT COUNT(*)::int as c FROM public.candidates WHERE email_lc = ${emailLower} AND COALESCE(deleted_at, NULL) IS NULL`
    const count = Number(countRes.rows?.[0]?.c || 0)

    const res = NextResponse.json({ ok: true, email: emailLower, count, recent: rowsAll.rows })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', 'all_orgs')
    res.headers.set('X-Org-Id', '')
    return res
  } catch (e: any) {
    const res = NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', 'all_orgs')
    res.headers.set('X-Org-Id', '')
    return res
  }
}
