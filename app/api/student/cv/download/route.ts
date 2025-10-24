import { NextRequest, NextResponse } from 'next/server'
import { sql, getDbInfo } from '@/lib/db'
import { createServerClient } from '@/lib/supabase-server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getPresignedUrl } from '@/lib/storage'

// Match presign normalization so keys work across providers
function deriveKey(input: string): { keyForStorage: string; raw: string } {
  const raw = input.trim()
  const providerEnv = (process.env.STORAGE_PROVIDER || '').toLowerCase()
  const vercelBlobToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
  const provider = providerEnv || (vercelBlobToken ? 'vercel' : '')
  const bucket = process.env.SUPABASE_BUCKET || 'cv-uploads'

  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      let path = u.pathname.replace(/^\/+/, '')
      if (path.startsWith('storage/v1/object/public/')) {
        path = path.substring('storage/v1/object/public/'.length)
      }
      if (provider !== 'vercel') {
        if (path.startsWith(bucket + '/')) path = path.substring(bucket.length + 1)
      }
      return { keyForStorage: path, raw }
    } catch {}
  }
  let key = raw
  if (provider !== 'vercel') {
    if (key.startsWith(bucket + '/')) key = key.substring(bucket.length + 1)
  }
  return { keyForStorage: key, raw }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: NextRequest) {
  const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const { host: dbHost, db: dbName } = getDbInfo()

  // Auth (student session)
  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}
  if (!emailLower) {
    const res = NextResponse.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', '')
    return res
  }

  const { searchParams } = new URL(req.url)
  const keyParam = (searchParams.get('key') || '').trim()
  const requestedOrg = (searchParams.get('org') || '').trim()
  if (!keyParam) {
    const res = NextResponse.json({ ok: false, error: 'Missing key', code: 'BAD_REQUEST' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    return res
  }

  const providerEnv = (process.env.STORAGE_PROVIDER || '').toLowerCase()
  const vercelBlobToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
  const provider = providerEnv || (vercelBlobToken ? 'vercel' : '')
  const bucket = process.env.SUPABASE_BUCKET || 'cv-uploads'
  const { keyForStorage, raw } = deriveKey(keyParam)

  try {
    // Ensure activity table exists (audit only; no hard rate limit here)
    try {
      await sql`CREATE TABLE IF NOT EXISTS student_activity (id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL, action TEXT NOT NULL, metadata JSONB, created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW())`
    } catch {}

    // Verify ownership
    let owned = false
    let foundOrgSlug: string | null = null
    try {
      const exists = await sql<{ c: string | null }>`SELECT to_regclass('public.candidates') as c`
      if (exists.rows?.[0]?.c) {
        const c = await sql<{ org_slug: string | null }>`
          SELECT COALESCE(o.slug,'') AS org_slug
          FROM candidates c
          LEFT JOIN organizations o ON o.id = c.org_id
          WHERE LOWER(email) = ${emailLower}
            AND (
              c.cv_blob_key = ${raw}
              OR c.cv_blob_key = ${keyForStorage}
              OR c.cv_blob_key ILIKE ${'%' + keyForStorage + '%'}
              OR c.cv_blob_key ILIKE ${'%' + raw + '%'}
            )
          LIMIT 1
        `
        owned = c.rows.length > 0
        foundOrgSlug = owned ? (c.rows?.[0]?.org_slug || null) : null
      }
    } catch {}

    if (!owned) {
      try {
        const s = await sql`SELECT 1 FROM students WHERE LOWER(email) = ${emailLower} AND (cv_url = ${raw} OR cv_url ILIKE ${'%' + raw + '%'} OR cv_url ILIKE ${'%' + keyForStorage + '%'}) LIMIT 1`
        owned = s.rows.length > 0
      } catch {}
    }

    if (!owned) {
      const res = NextResponse.json({ ok: false, error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      return res
    }

    if (requestedOrg && foundOrgSlug && requestedOrg !== foundOrgSlug) {
      const res = NextResponse.json({ ok: false, error: 'Wrong organization', code: 'WRONG_ORG', org: foundOrgSlug }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', foundOrgSlug)
      return res
    }

    // Check if cv_blob_key exists
    if (!raw && !keyForStorage) {
      const res = NextResponse.json({ ok: false, error: 'No CV file found for this submission', code: 'NO_FILE' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      return res
    }

    // For Vercel Blob URLs (already public), just redirect directly
    if (/^https:\/\/.*\.public\.blob\.vercel-storage\.com\//i.test(raw || keyForStorage)) {
      const cleanUrl = (raw || keyForStorage).trim()
      try {
        const res = NextResponse.redirect(new URL(cleanUrl), { status: 302 })
        res.headers.set('X-Trace-Id', traceId)
        res.headers.set('X-DB-Host', dbHost)
        res.headers.set('X-DB-Name', dbName)
        res.headers.set('X-User-Email', emailLower)
        return res
      } catch (urlErr: any) {
        console.error('[DOWNLOAD] Invalid Vercel Blob URL:', { url: cleanUrl, error: urlErr?.message })
      }
    }

    // For other storage (Supabase), presign and redirect
    try {
      const { url } = await getPresignedUrl(raw || keyForStorage, 60)
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid URL from presign')
      }
      const res = NextResponse.redirect(new URL(url), { status: 302 })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      return res
    } catch (redirectErr: any) {
      console.log('[DOWNLOAD] Redirect failed, falling back to stream:', redirectErr?.message)
      // Fallback: proxy stream (legacy path)
      let streamBody: ReadableStream | null = null
      let contentType = 'application/octet-stream'
      let contentLength: number | undefined

      if (provider === 'vercel') {
        const { getSignedUrl } = await import('@vercel/blob') as any
        const signed = await getSignedUrl({ pathname: keyForStorage, expiresIn: 60, token: vercelBlobToken, type: 'get' } as any)
        const url: string = signed?.url || signed?.signedUrl
        if (!url) throw new Error('BLOB_SIGN_FAILED')
        const r = await fetch(url)
        if (!r.ok) throw new Error('BLOB_FETCH_FAILED')
        streamBody = r.body as any
        contentType = r.headers.get('content-type') || contentType
        const len = r.headers.get('content-length')
        contentLength = len ? Number(len) : undefined
      } else {
        const supaUrl = process.env.SUPABASE_URL
        const service = process.env.SUPABASE_SERVICE_ROLE
        if (!supaUrl || !service) throw new Error('SUPABASE_NOT_CONFIGURED')
        const supa = createSupabaseClient(supaUrl, service)
        const { data, error } = await supa.storage.from(bucket).download(keyForStorage)
        if (error || !data) throw new Error('SUPABASE_DOWNLOAD_FAILED')
        const ab = await data.arrayBuffer()
        streamBody = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(ab))
            controller.close()
          },
        })
        contentType = (data as any).type || contentType
        contentLength = ab.byteLength
      }

      try { await sql`INSERT INTO student_activity (email, action, metadata) VALUES (${emailLower}, 'download_cv_stream', jsonb_build_object('key', ${keyForStorage}))` } catch {}

      const filename = (() => {
        const base = keyForStorage.split('/').pop() || 'cv.pdf'
        return base
      })()

      const headers = new Headers({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Trace-Id': traceId,
        'X-DB-Host': dbHost,
        'X-DB-Name': dbName,
      })
      if (contentLength != null && !Number.isNaN(contentLength)) headers.set('Content-Length', String(contentLength))

      return new Response(streamBody as any, { headers })
    }
  } catch (e: any) {
    console.error('[STUDENT_DOWNLOAD_ERROR]', {
      message: e?.message || e,
      key: keyParam,
      emailLower,
      traceId
    })
    const errorMsg = String(e?.message || '').includes('MISSING_KEY') 
      ? 'No CV file found for this submission'
      : String(e?.message || '').includes('NOT_CONFIGURED')
      ? 'Storage not configured'
      : 'Download failed'
    const res = NextResponse.json({ 
      ok: false, 
      error: errorMsg, 
      code: 'DOWNLOAD_FAILED',
      detail: process.env.NODE_ENV === 'development' ? e?.message : undefined
    }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower || '')
    res.headers.set('X-Error-Type', e?.message || 'unknown')
    return res
  }
}
