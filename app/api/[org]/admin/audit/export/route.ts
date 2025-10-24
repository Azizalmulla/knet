import { jwtVerify } from '@/lib/esm-compat/jose'
import { sql } from '@vercel/postgres'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET(request: Request, { params }: { params: { org: string } }) {
  const orgSlug = params.org

  const url = new URL(request.url)
  const qp = (k: string) => (url.searchParams.get(k) || '').trim()
  const action = qp('action')
  const adminEmail = qp('admin_email')
  const from = qp('from')
  const to = qp('to')
  const hardLimit = Math.max(1, Math.min(200000, parseInt(qp('limit') || '100000', 10) || 100000))

  // Per-admin/IP rate limit 1/min
  const adminId = (request.headers.get('x-admin-id') || '').trim()
  let adminEmailHdr = (request.headers.get('x-admin-email') || '').trim()
  if (!adminEmailHdr) {
    try {
      const cookie = request.headers.get('cookie') || ''
      const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/)
      const token = m && m[1] ? decodeURIComponent(m[1]) : ''
      if (token) {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production')
        const { payload } = await jwtVerify(token, secret)
        adminEmailHdr = String((payload as any)?.email || '')
      }
    } catch {}
  }
  const namespace = `admin-audit-export:${orgSlug}:${adminEmailHdr || adminId || 'anon'}`
  const rl = checkRateLimitWithConfig(request, { maxRequests: 1, windowMs: 60_000, namespace })
  if (!rl.success) return createRateLimitResponse(rl)

  try {
    const orgRes = await sql`SELECT id::uuid as id, slug FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) return new Response('Organization not found', { status: 404 })
    const orgId = orgRes.rows[0].id as string

    const conds: string[] = ['a.organization_id = $1']
    const values: any[] = [orgId]
    let p = 2
    if (from) { conds.push(`a.timestamp >= $${p}`); values.push(new Date(from)); p++ }
    if (to) { conds.push(`a.timestamp <= $${p}`); values.push(new Date(to)); p++ }
    if (action) { conds.push(`a.action = $${p}`); values.push(action); p++ }
    if (adminEmail) { conds.push(`COALESCE(LOWER(a.metadata->>'admin_email'),'') = LOWER($${p})`); values.push(adminEmail); p++ }

    const whereSQL = `WHERE ${conds.join(' AND ')}`

    const selectSQL = `
      SELECT 
        a.timestamp as timestamp,
        a.action,
        (a.metadata->>'admin_email') as admin_email,
        (a.metadata->>'ip') as ip,
        (a.metadata->>'user_agent') as user_agent,
        a.metadata as metadata
      FROM admin_activity a
      ${whereSQL}
      ORDER BY a.timestamp DESC
      OFFSET $${p}
      LIMIT $${p+1}
    `

    // Audit self: export_audit_csv
    try {
      await sql`
        INSERT INTO admin_activity (organization_id, action, metadata)
        VALUES (
          ${orgId}::uuid,
          'export_audit_csv',
          jsonb_build_object(
            'filters', ${JSON.stringify({ action, adminEmail, from, to })},
            'admin_email', NULLIF(${adminEmailHdr}, '')
          )
        )
      `
    } catch {}

    const encoder = new TextEncoder()
    const today = new Date().toISOString().split('T')[0]
    const suffixParts = [action && `action-${action}`, adminEmail && `admin-${adminEmail}`].filter(Boolean)
    const suffix = suffixParts.length ? `_${suffixParts.join('_')}` : ''
    const headers = new Headers({
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename=audit_${orgSlug}_${today}_filters${suffix}.csv`,
      'cache-control': 'no-cache'
    })

    let offset = 0
    const chunk = 5000
    const headerLine = 'timestamp,action,admin_email,ip,user_agent,metadata_json\n'

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(headerLine))
        let exported = 0
        while (exported < hardLimit) {
          const take = Math.min(chunk, hardLimit - exported)
          const res = await sql.query(selectSQL, [...values, offset, take])
          if (!res.rows.length) break
          const lines = res.rows.map(r => {
            const cells = [
              new Date(r.timestamp).toISOString(),
              r.action,
              r.admin_email,
              r.ip,
              r.user_agent,
              JSON.stringify(r.metadata || {})
            ].map((v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"')
            return cells.join(',')
          }).join('\n') + '\n'
          controller.enqueue(encoder.encode(lines))
          exported += res.rows.length
          offset += res.rows.length
          if (res.rows.length < take) break
        }
        controller.close()
      }
    })

    return new Response(stream as any, { headers })
  } catch (e) {
    console.error('Audit export failed:', (e as any)?.message || e)
    return new Response('Export failed', { status: 500 })
  }
}
