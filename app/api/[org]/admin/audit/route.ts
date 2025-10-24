// Avoid importing next/server to keep Jest environment simple
import { sql } from '@vercel/postgres'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET(request: Request, { params }: { params: { org: string } }) {
  const started = Date.now()
  const orgSlug = params.org

  // Rate limit: 60 req / 5 min / IP
  const rl = checkRateLimitWithConfig(request, { maxRequests: 60, windowMs: 5 * 60_000, namespace: 'admin-audit' })
  if (!rl.success) return createRateLimitResponse(rl)

  const url = new URL(request.url)
  const qp = (k: string) => (url.searchParams.get(k) || '').trim()
  const from = qp('from')
  const to = qp('to')
  const action = qp('action')
  const adminEmail = qp('admin_email')
  const ip = qp('ip')
  const userAgent = qp('user_agent')
  const candidate = qp('candidate')
  const limit = Math.max(1, Math.min(200, parseInt(qp('limit') || '50', 10) || 50))
  const offset = Math.max(0, parseInt(qp('offset') || '0', 10) || 0)

  try {
    // resolve org id
    const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) return new Response(JSON.stringify({ events: [], total: 0 }), { headers: { 'content-type': 'application/json' } })
    const orgId = orgRes.rows[0].id as string

    const conds: string[] = ['a.organization_id = $1']
    const values: any[] = [orgId]
    let p = 2
    if (from) { conds.push(`a.timestamp >= $${p}`); values.push(new Date(from)); p++ }
    if (to) { conds.push(`a.timestamp <= $${p}`); values.push(new Date(to)); p++ }
    if (action) { conds.push(`a.action = $${p}`); values.push(action); p++ }
    if (adminEmail) { conds.push(`COALESCE(LOWER(a.metadata->>'admin_email'),'') = LOWER($${p})`); values.push(adminEmail); p++ }
    if (ip) { conds.push(`COALESCE(a.metadata->>'ip','') = $${p}`); values.push(ip); p++ }
    if (userAgent) { conds.push(`COALESCE(a.metadata->>'user_agent','') = $${p}`); values.push(userAgent); p++ }
    if (candidate) { conds.push(`COALESCE(LOWER(c.full_name),'') LIKE LOWER($${p})`); values.push(`%${candidate}%`); p++ }

    const whereSQL = `WHERE ${conds.join(' AND ')}`

    const q = `
      SELECT 
        a.timestamp as created_at,
        a.action,
        (a.metadata->>'candidate_id') as candidate_id,
        (a.metadata->>'admin_email') as admin_email,
        (a.metadata->>'ip') as ip,
        (a.metadata->>'user_agent') as user_agent,
        a.metadata as metadata,
        o.name as org_name,
        COALESCE(c.full_name, NULL) as candidate_name
      FROM admin_activity a
      LEFT JOIN candidates c ON c.id::text = (a.metadata->>'candidate_id')
      LEFT JOIN organizations o ON o.id = a.organization_id
      ${whereSQL}
      ORDER BY a.timestamp DESC
      OFFSET $${p}
      LIMIT $${p+1}
    `
    const res = await sql.query(q, [...values, offset, limit])

    // total count for pagination
    const countQ = `SELECT COUNT(*)::int as cnt FROM admin_activity a LEFT JOIN candidates c ON c.id::text = (a.metadata->>'candidate_id') ${whereSQL}`
    const countRes = await sql.query(countQ, values)
    const total = (countRes.rows?.[0]?.cnt as number) || 0

    const took = Date.now() - started
    try { console.log('[ADMIN_AUDIT]', JSON.stringify({ org_slug: orgSlug, took_ms: took, rows: res.rowCount })) } catch {}

    return new Response(JSON.stringify({ events: res.rows, total }), { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    console.error('Audit fetch failed:', (error as any)?.message || error)
    return new Response(JSON.stringify({ events: [], error: 'Failed' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}
