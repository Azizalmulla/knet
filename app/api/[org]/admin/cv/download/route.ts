import { NextRequest } from 'next/server'
import { sql } from '@vercel/postgres'
import { getPresignedUrl } from '@/lib/storage'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'
import { getDbInfo } from '@/lib/db'

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET(request: NextRequest, { params }: { params: { org: string } }) {
  const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const orgSlug = params.org

  // Basic rate limit: 20 requests / 60s per IP
  const ns = `admin-download:${orgSlug}`
  const rl = checkRateLimitWithConfig(request, { maxRequests: 20, windowMs: 60_000, namespace: ns })
  if (!rl.success) return createRateLimitResponse(rl)

  try {
    const url = new URL(request.url)
    const candidateId = (url.searchParams.get('candidateId') || '').trim()
    if (!candidateId) {
      const res = new Response(JSON.stringify({ error: 'Missing candidateId' }), { status: 400, headers: { 'content-type': 'application/json' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-Org-Slug', orgSlug)
      return res
    }

    const { rows } = await sql`
      SELECT c.id::uuid as id, c.full_name, COALESCE(c.cv_blob_key, '') as key, o.id::uuid as org_id
      FROM public.candidates c
      JOIN organizations o ON o.id = c.org_id
      WHERE c.id::uuid = ${candidateId}::uuid AND o.slug = ${orgSlug}
      LIMIT 1
    `
    if (!rows.length) {
      const res = new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-Org-Slug', orgSlug)
      return res
    }

    const row: any = rows[0]
    const key: string = row.key || ''
    if (!key) {
      const res = new Response(JSON.stringify({ error: 'No CV file' }), { status: 404, headers: { 'content-type': 'application/json' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-Org-Slug', orgSlug)
      return res
    }

    // Presign, fetch, and stream back with Content-Disposition (retry once on failure)
    let presigned = await getPresignedUrl(key, 60)
    let upstream = await fetch(presigned.url)
    if (!upstream.ok || !upstream.body) {
      // Retry once with a fresh presign (handles expired links)
      try {
        presigned = await getPresignedUrl(key, 60)
        upstream = await fetch(presigned.url)
      } catch {}
      if (!upstream.ok || !upstream.body) {
        const res = new Response(JSON.stringify({ error: 'Upstream fetch failed' }), { status: 502, headers: { 'content-type': 'application/json' } })
        res.headers.set('X-Trace-Id', traceId)
        res.headers.set('X-Org-Slug', orgSlug)
        return res
      }
    }

    const safeName = String(row.full_name || 'candidate').replace(/[^a-z0-9_\-\s]+/gi, '').trim().replace(/\s+/g, '_') || 'candidate'
    const headers = new Headers()
    headers.set('Content-Type', 'application/pdf')
    headers.set('Content-Disposition', `attachment; filename="${safeName}.pdf"`)
    headers.set('Cache-Control', 'no-store')
    const { db: dbName } = getDbInfo()
    headers.set('X-Trace-Id', traceId)
    headers.set('X-DB-Name', dbName)
    headers.set('X-Org-Slug', orgSlug)

    return new Response(upstream.body, { status: 200, headers })
  } catch (e: any) {
    const res = new Response(JSON.stringify({ error: 'Download failed', message: String(e?.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } })
    res.headers.set('X-Trace-Id', (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`)
    res.headers.set('X-Org-Slug', params.org)
    return res
  }
}
