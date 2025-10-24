// Avoid next/server types for Jest compatibility
import { sql } from '@vercel/postgres'
import { getDbInfo } from '@/lib/db'
import { getPresignedUrl } from '@/lib/storage'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

// Ensure connection string
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function POST(request: Request, { params }: { params: { org: string } }) {
  const started = Date.now()
  const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const orgSlug = params.org
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  const adminId = request.headers.get('x-admin-id') || ''
  const adminEmail = request.headers.get('x-admin-email') || ''
  const adminKeyHdr = request.headers.get('x-admin-key') || ''

  // Basic rate limit: 20 requests / 60s, per-admin if available
  const ns = `admin-presign:${orgSlug}:${adminEmail || adminId || 'anon'}`
  const rl = checkRateLimitWithConfig(request, { maxRequests: 20, windowMs: 60_000, namespace: ns })
  if (!rl.success) return createRateLimitResponse(rl)

  try {
    const body = await request.json().catch(() => ({}))
    const candidateId = String(body?.candidateId || '').trim()
    if (!candidateId) return new Response(JSON.stringify({ error: 'Missing candidateId' }), { status: 400, headers: { 'content-type': 'application/json' } })

    // Strict org isolation via join on org
    const { rows } = await sql`
      SELECT c.id::text, c.cv_blob_key, o.slug, o.id::uuid as org_id
      FROM public.candidates c
      JOIN organizations o ON o.id = c.org_id
      WHERE c.id::uuid = ${candidateId}::uuid AND o.slug = ${orgSlug}
      LIMIT 1
    `
    if (!rows.length) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } })

    const row: any = rows[0]
    const key: string = row.cv_blob_key || ''
    if (!key) return new Response(JSON.stringify({ error: 'No CV file' }), { status: 404, headers: { 'content-type': 'application/json' } })

    const presigned = await getPresignedUrl(key, 60)

    const took = Date.now() - started
    try {
      console.log('[ADMIN_CV_PRESIGN]', JSON.stringify({ org_slug: orgSlug, candidate_id: candidateId, admin_id: adminId, admin_email: adminEmail, ip, took_ms: took }))
    } catch {}

    // Audit log (idempotent table exists in migrations)
    try {
      await sql`
        INSERT INTO admin_activity (admin_id, organization_id, action, metadata)
        VALUES (
          NULLIF(${adminId}, '')::uuid,
          ${rows[0].org_id}::uuid,
          'cv_presign',
          jsonb_build_object(
            'candidate_id', ${candidateId},
            'admin_email', NULLIF(${adminEmail}, ''),
            'ip', ${ip},
            'user_agent', ${request.headers.get('user-agent') || ''}
          )
        )
      `
      // Also log a generic download action for parity
      await sql`
        INSERT INTO admin_activity (admin_id, organization_id, action, metadata)
        VALUES (
          NULLIF(${adminId}, '')::uuid,
          ${rows[0].org_id}::uuid,
          'download_cv',
          jsonb_build_object(
            'candidate_id', ${candidateId},
            'admin_email', NULLIF(${adminEmail}, ''),
            'ip', ${ip},
            'user_agent', ${request.headers.get('user-agent') || ''}
          )
        )
      `
    } catch (e) {
      try { console.warn('[ADMIN_ACTIVITY_INSERT_FAILED]', String((e as any)?.message || e)) } catch {}
    }
    const res = new Response(JSON.stringify({ url: presigned.url, expiresAt: presigned.expiresAt }), { headers: { 'content-type': 'application/json' } })
    try {
      const { db: dbName } = getDbInfo()
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-Org-Slug', orgSlug)
      if (adminEmail) res.headers.set('X-Admin-Email', adminEmail)
      res.headers.set('X-DB-Name', dbName)
    } catch {}
    return res
  } catch (error: any) {
    console.error('Presign failed', error?.message || error)
    const res = new Response(JSON.stringify({ error: 'Failed to presign' }), { status: 500, headers: { 'content-type': 'application/json' } })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-Org-Slug', orgSlug)
    return res
  }
}
