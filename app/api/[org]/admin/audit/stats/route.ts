import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from '@/lib/esm-compat/jose'
import { sql } from '@vercel/postgres'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

// Returns last 30 days counts for the current admin (by email header) within the org
// Response: { my: { export_candidates_csv: number, cv_presign: number, admin_login_success: number } }
export async function GET(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  let adminEmail = (request.headers.get('x-admin-email') || '').trim().toLowerCase()
  if (!adminEmail) {
    try {
      const cookie = request.headers.get('cookie') || ''
      const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/)
      const token = m && m[1] ? decodeURIComponent(m[1]) : ''
      if (token) {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production')
        const { payload } = await jwtVerify(token, secret)
        adminEmail = String((payload as any)?.email || '').toLowerCase()
      }
    } catch {}
  }

  const rl = checkRateLimitWithConfig(request, { maxRequests: 30, windowMs: 5 * 60_000, namespace: `admin-audit-stats:${orgSlug}:${adminEmail||'anon'}` })
  if (!rl.success) return createRateLimitResponse(rl)

  try {
    const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) return NextResponse.json({ my: { export_candidates_csv: 0, cv_presign: 0, admin_login_success: 0 } })
    const orgId = orgRes.rows[0].id as string

    // If no admin email, just return zeros
    if (!adminEmail) {
      return NextResponse.json({ my: { export_candidates_csv: 0, cv_presign: 0, admin_login_success: 0 } })
    }

    const q = `
      SELECT 
        SUM(CASE WHEN a.action = 'export_candidates_csv' AND LOWER(a.metadata->>'admin_email') = $2 AND a.timestamp >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS export_candidates_csv,
        SUM(CASE WHEN a.action = 'cv_presign' AND LOWER(a.metadata->>'admin_email') = $2 AND a.timestamp >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS cv_presign,
        SUM(CASE WHEN a.action = 'admin_login_success' AND LOWER(a.metadata->>'admin_email') = $2 AND a.timestamp >= NOW() - INTERVAL '30 days' THEN 1 ELSE 0 END)::int AS admin_login_success
      FROM admin_activity a
      WHERE a.organization_id = $1
    `

    const res = await sql.query(q, [orgId, adminEmail])
    const row = res.rows?.[0] || {}
    // 7-day activity series (all actions)
    const seriesQ = `
      SELECT to_char(date_trunc('day', a.timestamp), 'YYYY-MM-DD') as day, COUNT(*)::int as count
      FROM admin_activity a
      WHERE a.organization_id = $1
        AND a.timestamp >= date_trunc('day', NOW()) - INTERVAL '6 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `
    const seriesRes = await sql.query(seriesQ, [orgId])

    return NextResponse.json({ my: {
      export_candidates_csv: Number(row.export_candidates_csv || 0),
      cv_presign: Number(row.cv_presign || 0),
      admin_login_success: Number(row.admin_login_success || 0),
    }, series7d: seriesRes.rows })
  } catch (e) {
    console.error('Audit stats failed', (e as any)?.message || e)
    return NextResponse.json({ my: { export_candidates_csv: 0, cv_presign: 0, admin_login_success: 0 }, series7d: [] })
  }
}
