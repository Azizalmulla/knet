import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { createServerClient } from '@/lib/supabase-server';
import { sql, getDbInfo } from '@/lib/db';
import { peekRateLimitWithConfig, consumeRateLimitWithConfig } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function POST(req: NextRequest) {
  try {
    const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json(
        { ok: false, error: 'BLOB_NOT_CONFIGURED' },
        { status: 500, headers: cors }
      );
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Name', dbName)
      return res
    }

    // Auth: Supabase student session required
    let emailLower: string | null = null
    try {
      const supabase = createServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) emailLower = user.email.toLowerCase()
    } catch {}
    if (!emailLower) {
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers: cors })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', '')
      res.headers.set('Cache-Control', 'no-store')
      return res
    }

    const form = await req.formData();
    const file = form.get('file') as File | null;
    const orgSlugFromForm = (form.get('orgSlug') as string | null) || '';
    const orgSlugHeader = (req.headers.get('x-org-slug') || '').trim()
    const orgSlug = (orgSlugHeader || orgSlugFromForm || '').trim()

    if (!file) {
      const { db: dbName } = getDbInfo()
      const res = NextResponse.json(
        { ok: false, error: 'NO_FILE' },
        { status: 400, headers: cors }
      );
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      return res
    }

    // Require a valid organization
    if (!orgSlug) {
      const { db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, error: 'ORG_REQUIRED' }, { status: 400, headers: cors })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      return res
    }
    let orgId: string | null = null
    try {
      const r = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
      if (r.rows.length) orgId = r.rows[0].id as string
    } catch {}
    if (!orgId) {
      const { db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, error: 'ORG_NOT_FOUND' }, { status: 404, headers: cors })
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', orgSlug)
      return res
    }

    // Rate limit (peek only): 10/min per user+org; consume on success only
    const peek = peekRateLimitWithConfig(req, { maxRequests: 10, windowMs: 60_000, namespace: `blob-upload:${emailLower}:${orgSlug}`, useIp: false })
    if (!peek.success) {
      const res = NextResponse.json({ ok: false, error: 'RATE_LIMIT', message: 'Too many requests. Try again in a minute.' }, { status: 429, headers: cors })
      res.headers.set('X-RateLimit-Limit', String(peek.limit))
      res.headers.set('X-RateLimit-Remaining', String(peek.remaining))
      res.headers.set('X-RateLimit-Reset', String(Math.ceil(peek.resetTime / 1000)))
      res.headers.set('Retry-After', String(Math.max(1, Math.ceil((peek.resetTime - Date.now())/1000))))
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', orgSlug)
      return res
    }

    // Validation
    if (file.size > 10 * 1024 * 1024) {
      const res = NextResponse.json(
        { ok: false, error: 'FILE_TOO_LARGE', message: 'Max size 10MB' },
        { status: 413, headers: cors }
      );
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', orgSlug)
      return res
    }

    const contentType = (file as any).type || 'application/octet-stream';
    if (contentType !== 'application/pdf') {
      const res = NextResponse.json(
        { ok: false, error: 'PDF_ONLY' },
        { status: 415, headers: cors }
      );
      res.headers.set('X-Trace-Id', traceId)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', orgSlug)
      return res
    }
    // Verify PDF magic bytes %PDF
    try {
      const ab = await file.arrayBuffer()
      const view = new Uint8Array(ab)
      const sig = [0x25, 0x50, 0x44, 0x46] // %PDF
      let okSig = view.length >= sig.length
      for (let i = 0; i < sig.length && okSig; i++) { if (view[i] !== sig[i]) okSig = false }
      if (!okSig) {
        const res = NextResponse.json(
          { ok: false, error: 'PDF_MAGIC_INVALID', message: 'Invalid PDF file' },
          { status: 400, headers: cors }
        );
        res.headers.set('X-Trace-Id', traceId)
        res.headers.set('X-User-Email', emailLower)
        res.headers.set('X-Org-Slug', orgSlug)
        return res
      }
    } catch {}
    const originalName = (file as any).name || 'upload';
    const safeOrg = orgSlug.replace(/[^a-z0-9-_]/gi, '').toLowerCase();
    const prefix = `cvs/${safeOrg}/`
    const filename = `${prefix}${Date.now()}-${originalName}`;

    const { url } = await put(filename, file, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    // Audit: student_activity upload_cv
    try {
      await sql`CREATE TABLE IF NOT EXISTS student_activity (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        action TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_student_activity_email_action_time ON student_activity ((LOWER(email)), action, created_at)`
      await sql`INSERT INTO student_activity (email, action, metadata) VALUES (
        ${emailLower}, 'upload_cv', jsonb_build_object('org_slug', ${orgSlug}, 'blob_key', ${filename})
      )`;
    } catch {}

    // Consume token only after success
    try { consumeRateLimitWithConfig(req, { maxRequests: 10, windowMs: 60_000, namespace: `blob-upload:${emailLower}:${orgSlug}`, useIp: false }) } catch {}

    const { db: dbName } = getDbInfo()
    const res = NextResponse.json(
      { ok: true, url, key: filename },
      { status: 200, headers: cors }
    );
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', orgSlug)
    return res
  } catch (err: any) {
    const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const { db: dbName } = getDbInfo()
    const res = NextResponse.json(
      { ok: false, error: 'UPLOAD_FAILED', message: String(err?.message ?? err) },
      { status: 500, headers: cors }
    );
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Name', dbName)
    return res
  }
}
