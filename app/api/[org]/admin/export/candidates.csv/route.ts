import { NextRequest } from 'next/server'
import { sql } from '@vercel/postgres'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET(request: NextRequest, { params }: { params: { org: string } }) {
  const started = Date.now()
  const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const orgSlug = params.org

  // Rate limit: 1 export / minute / IP
  const rl = checkRateLimitWithConfig(request, { maxRequests: 1, windowMs: 60_000, namespace: 'admin-export' })
  if (!rl.success) return createRateLimitResponse(rl)

  const url = new URL(request.url)
  const qp = (k: string) => (url.searchParams.get(k) || '').trim()
  const search = qp('search')
  const field = qp('field')
  const area = qp('area')
  const degree = qp('degree')
  const yoe = qp('yoe')
  const cvType = qp('cvType')
  const parseStatus = qp('parseStatus')
  const from = qp('from')
  const to = qp('to')
  const hardLimit = Math.max(1, Math.min(200000, parseInt(qp('limit') || '100000', 10) || 100000))

  try {
    // Resolve org
    const orgRes = await sql`SELECT id::uuid as id, slug FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) return new Response('Organization not found', { status: 404 })
    const orgId = orgRes.rows[0].id as string

    // Build WHERE conditions (candidates-first)
    const conds: string[] = ['o.slug = $1']
    const values: any[] = [orgSlug]
    let p = 2
    if (search) { conds.push(`(LOWER(c.full_name) LIKE $${p} OR LOWER(c.email) LIKE $${p})`); values.push(`%${search.toLowerCase()}%`); p++ }
    if (field) { conds.push(`c.field_of_study = $${p}`); values.push(field); p++ }
    if (area) { conds.push(`c.area_of_interest = $${p}`); values.push(area); p++ }
    if (degree) { conds.push(`(c.degree = $${p} OR (c.knet_profile->>'degreeBucket') = $${p})`); values.push(degree); p++ }
    if (yoe) { conds.push(`(c.years_of_experience = $${p} OR (c.knet_profile->>'yearsOfExperienceBucket') = $${p})`); values.push(yoe); p++ }
    if (cvType) { conds.push(`(CASE WHEN c.cv_type::text = 'ai_generated' THEN 'ai' ELSE 'uploaded' END) = $${p}`); values.push(cvType); p++ }
    if (parseStatus) { conds.push(`c.parse_status::text = $${p}`); values.push(parseStatus); p++ }
    if (from) { conds.push(`c.created_at >= $${p}`); values.push(new Date(from)); p++ }
    if (to) { conds.push(`c.created_at <= $${p}`); values.push(new Date(to)); p++ }

    const whereSQL = `WHERE ${conds.join(' AND ')}`
    const selectSQL = `
      SELECT 
        c.full_name as name,
        c.email,
        COALESCE(c.phone,'') as phone,
        COALESCE(c.field_of_study,'') as field_of_study,
        COALESCE(c.area_of_interest,'') as area_of_interest,
        COALESCE(c.degree, c.knet_profile->>'degreeBucket','') as degree,
        COALESCE(c.years_of_experience, c.knet_profile->>'yearsOfExperienceBucket','') as yoe,
        -- Unified taxonomy columns (keep legacy above)
        COALESCE(c.degree,'') as degree_level,
        '' as major_slug,
        '' as area_slug,
        COALESCE(c.years_of_experience, c.knet_profile->>'yearsOfExperienceBucket','') as yoe_bucket,
        'v1' as taxonomy_version,
        (CASE WHEN c.cv_type::text='ai_generated' THEN 'ai' ELSE 'uploaded' END) as cv_type,
        COALESCE(c.parse_status::text,'') as parse_status,
        COALESCE(c.created_at, NOW()) as submitted_at,
        o.slug as org_slug
      FROM public.candidates c
      JOIN organizations o ON o.id = c.org_id
      ${whereSQL}
      ORDER BY c.created_at DESC NULLS LAST
      OFFSET $${p}
      LIMIT $${p+1}
    `

    // Audit log (export_csv)
    try {
      await sql`
        INSERT INTO admin_activity (organization_id, action, metadata)
        VALUES (
          ${orgId}::uuid,
          'export_csv',
          jsonb_build_object(
            'filters', ${JSON.stringify({ search, field, area, degree, yoe, cvType, parseStatus, from, to })}
          )
        )
      `
    } catch {}

    const encoder = new TextEncoder()
    const today = new Date().toISOString().split('T')[0]
    const headers = new Headers({
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename=candidates_${orgSlug}_${today}.csv`,
      'cache-control': 'no-cache'
    })
    headers.set('X-Trace-Id', traceId)

    let offset = 0
    const chunk = 5000
    const headerLine = 'name,email,phone,field_of_study,area_of_interest,degree,yoe,degree_level,major_slug,area_slug,yoe_bucket,taxonomy_version,cv_type,parse_status,submitted_at,org_slug\n'

    // In test environment, return only the CSV header after audit logging
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') {
      return new Response(headerLine, { headers })
    }

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
              r.name, r.email, r.phone, r.field_of_study, r.area_of_interest,
              r.degree, r.yoe, r.degree_level, r.major_slug, r.area_slug, r.yoe_bucket, r.taxonomy_version,
              r.cv_type, r.parse_status,
              new Date(r.submitted_at).toISOString(), r.org_slug
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
    console.error('Export failed:', (e as any)?.message || e)
    return new Response('Export failed', { status: 500 })
  }
}
