import { NextRequest, NextResponse } from 'next/server'
import { sql, getDbInfo } from '@/lib/db'
import { getPresignedUrl } from '@/lib/storage'
import { createServerClient } from '@/lib/supabase-server'

function deriveKey(input: string): { keyForPresign: string; raw: string } {
  const raw = input.trim()
  const providerEnv = (process.env.STORAGE_PROVIDER || '').toLowerCase()
  const vercelBlobToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
  const provider = providerEnv || (vercelBlobToken ? 'vercel' : '')
  const bucket = process.env.SUPABASE_BUCKET || 'cv-uploads'

  // If a full URL was provided, parse pathname
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw)
      let path = u.pathname.replace(/^\/+/, '')
      // Supabase public URL form: storage/v1/object/public/<bucket>/<key>
      if (path.startsWith('storage/v1/object/public/')) {
        path = path.substring('storage/v1/object/public/'.length)
      }
      if (provider !== 'vercel') {
        // Supabase needs key within bucket only
        if (path.startsWith(bucket + '/')) path = path.substring(bucket.length + 1)
      }
      return { keyForPresign: path, raw }
    } catch {
      // Fallthrough to treat as a plain key
    }
  }

  // Not a full URL; normalize for Supabase if needed
  let key = raw
  if (provider !== 'vercel') {
    const bucket = process.env.SUPABASE_BUCKET || 'cv-uploads'
    if (key.startsWith(bucket + '/')) key = key.substring(bucket.length + 1)
  }
  return { keyForPresign: key, raw }
}

export async function GET(req: NextRequest) {
  const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  // Auth via Supabase (student)
  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}
  if (!emailLower) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', '')
    return res
  }

  const { searchParams } = new URL(req.url)
  const keyParam = (searchParams.get('key') || '').trim()
  if (!keyParam) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: 'Missing key', code: 'BAD_REQUEST' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    return res
  }
  const requestedOrg = (searchParams.get('org') || '').trim()

  const { keyForPresign, raw } = deriveKey(keyParam)

  // Ownership check across candidates (new) and students (legacy)
  try {
    // Ensure activity table exists for auditing
    try {
      await sql`CREATE TABLE IF NOT EXISTS student_activity (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_student_activity_email_action_time ON student_activity ((LOWER(email)), action, created_at)`;
    } catch {}

    // Light per-user rate limiting: 10 downloads per minute per email
    try {
      const r = await sql<{ cnt: number }>`
        SELECT COUNT(*)::int AS cnt
        FROM student_activity
        WHERE LOWER(email) = ${emailLower}
          AND action = 'download_cv'
          AND created_at > NOW() - INTERVAL '60 seconds'
      `
      const recent = (r.rows?.[0]?.cnt ?? 0) as number
      if (recent >= 10) {
        const { host: dbHost, db: dbName } = getDbInfo()
        const res = NextResponse.json({ ok: false, error: 'Too many requests. Try again in a minute.', code: 'RATE_LIMIT' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
        res.headers.set('X-DB-Host', dbHost)
        res.headers.set('X-DB-Name', dbName)
        res.headers.set('X-User-Email', emailLower)
        return res
      }
    } catch {}

    // Check candidates table exists
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
              OR c.cv_blob_key = ${keyForPresign}
              OR c.cv_blob_key ILIKE ${'%' + keyForPresign + '%'}
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
        const s = await sql`
          SELECT 1 FROM students
          WHERE LOWER(email) = ${emailLower}
            AND (
              cv_url = ${raw}
              OR cv_url ILIKE ${'%' + raw + '%'}
              OR cv_url ILIKE ${'%' + keyForPresign + '%'}
            )
          LIMIT 1
        `
        owned = s.rows.length > 0
      } catch {}
    }

    if (!owned) {
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      return res
    }

    // Optional org check: if client passes org and mismatch, deny
    if (requestedOrg && foundOrgSlug && requestedOrg !== foundOrgSlug) {
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, error: 'Wrong organization', code: 'WRONG_ORG', org: foundOrgSlug }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', foundOrgSlug)
      return res
    }

    // Presign and return
    try {
      const { url, expiresAt } = await getPresignedUrl(keyForPresign, 60)
      // Audit download event
      try {
        await sql`INSERT INTO student_activity (email, action, metadata) VALUES (
          ${emailLower}, 'download_cv', jsonb_build_object('key', ${keyForPresign}, 'raw', ${raw})
        )`;
      } catch {}
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: true, url, expiresAt }, { headers: { 'Cache-Control': 'no-store' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      if (foundOrgSlug) res.headers.set('X-Org-Slug', foundOrgSlug)
      return res
    } catch (e) {
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, error: 'Presign failed', code: 'PRESIGN_FAILED' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      if (foundOrgSlug) res.headers.set('X-Org-Slug', foundOrgSlug)
      return res
    }
  } catch (error) {
    console.error('student presign error', error)
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: 'Internal error', code: 'INTERNAL' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower || '')
    return res
  }
}
