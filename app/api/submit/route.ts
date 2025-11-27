import { NextRequest, NextResponse } from 'next/server'
import { sql, getDbInfo } from '@/lib/db'
import { findRowForAudit } from '@/lib/career-map'
import { normalizeYoE, normalizeArea } from '@/lib/watheefti-taxonomy'
import { peekRateLimitWithConfig, consumeRateLimitWithConfig, shouldSkipRateLimitForIdempotency } from '@/lib/rateLimit'
import { createServerClient } from '@/lib/supabase-server'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const traceId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  // 1) Auth: require a logged-in student (Supabase ONLY)
  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}
  if (!emailLower) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: 'You must be logged in to submit.' }, { status: 401 })
    res.headers.set('X-Trace-Id', traceId)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', '')
    return res
  }

  // 2) Parse body
  let data: any = {}
  try { data = await request.json() } catch {}

  // 3) Resolve organization slug from header/body/query for namespacing
  let orgSlug: string | null = null
  try {
    const fromHeader = request.headers.get('x-org-slug')
    const url = new URL(request.url)
    const fromQuery = url.searchParams.get('org')
    const fromBody = (data as any)?.orgSlug as string | undefined
    orgSlug = (fromHeader || fromBody || fromQuery || '').trim() || null
  } catch {}

  // 4) Schema readiness preflight (avoid 500s). If not ready, return friendly guidance.
  try {
    const [orgsReg, candReg] = await Promise.all([
      sql<{ c: string | null }>`SELECT to_regclass('public.organizations') as c`,
      sql<{ c: string | null }>`SELECT to_regclass('public.candidates') as c`,
    ])
    const [yoe, cvType, parseStatus] = await Promise.all([
      sql<{ t: string | null }>`SELECT to_regtype('yoe_bucket') as t`,
      sql<{ t: string | null }>`SELECT to_regtype('cv_type_enum') as t`,
      sql<{ t: string | null }>`SELECT to_regtype('parse_status_enum') as t`,
    ])
    const hasOrganizations = !!orgsReg.rows?.[0]?.c
    const hasCandidates = !!candReg.rows?.[0]?.c
    const hasEnums = !!yoe.rows?.[0]?.t && !!cvType.rows?.[0]?.t && !!parseStatus.rows?.[0]?.t

    let publicOrgs = 0
    if (hasOrganizations) {
      try {
        const r = await sql`SELECT COUNT(*)::int as c FROM organizations WHERE COALESCE(is_public,true) = true AND deleted_at IS NULL`
        publicOrgs = Number(r.rows?.[0]?.c || 0)
      } catch {
        // Fallback for schemas without is_public/deleted_at columns
        try {
          const r2 = await sql`SELECT COUNT(*)::int as c FROM organizations`
          publicOrgs = Number(r2.rows?.[0]?.c || 0)
        } catch {}
      }
    }

    const schemaReady = hasOrganizations && hasCandidates && hasEnums && publicOrgs > 0
    if (!schemaReady) {
      const missing: string[] = []
      if (!hasOrganizations) missing.push('organizations table')
      if (!hasCandidates) missing.push('candidates table')
      if (!hasEnums) missing.push('enums: yoe_bucket, cv_type_enum, parse_status_enum')
      if (publicOrgs <= 0) missing.push('seeded public organizations')
      const guidance = {
        ok: false,
        error: 'Service not ready: required schema is missing.',
        missing,
        action: 'Run migration',
        how: 'POST /api/admin/migrate with header x-migrate-token set to MIGRATION_TOKEN (or GET /api/admin/migrate?token=...)',
        tip: 'Set MIGRATION_TOKEN (or reuse NEXTAUTH_SECRET) in Vercel project env, redeploy, then call the endpoint.'
      }
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json(guidance, { status: 200 })
      // Respect demo kill-switch header
      try {
        let host = ''
        try { host = new URL(request.url).host.toLowerCase() } catch {}
        const rateLimitGloballyDisabled = String(process.env.SUBMIT_RATE_LIMIT_DISABLED || '').toLowerCase() === 'true' || host.endsWith('vercel.app')
        if (rateLimitGloballyDisabled) res.headers.set('X-RateLimit', 'disabled')
      } catch {}
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', String(emailLower))
      res.headers.set('X-Org-Slug', '')
      res.headers.set('X-Org-Id', '')
      res.headers.set('X-Loopback-Found', 'false')
      return res
    }
  } catch {}

  // 5) Friendly rate limiting (per-user + per-org, idempotent, relaxed in non-prod)
  const isBulk = !!(data as any)?.isBulk
  const maxRequests = 10
  const windowMs = 60_000
  let hostHeader = ''
  try { hostHeader = new URL(request.url).host.toLowerCase() } catch {}
  const rateLimitGloballyDisabled = String(process.env.SUBMIT_RATE_LIMIT_DISABLED || '').toLowerCase() === 'true' || hostHeader.endsWith('vercel.app')
  const disabled = rateLimitGloballyDisabled
  const namespace = isBulk 
    ? `submit-bulk:${emailLower}:${orgSlug || 'all'}`
    : `submit:${emailLower}:${orgSlug || 'all'}`
  const headerIdKey = (request.headers.get('x-idempotency-key') || '').trim()
  const derivedIdKey = `${emailLower}:${orgSlug || 'all'}:${(data as any)?.cvUrl || (data as any)?.cv_blob_key || ''}`
  const idKey = headerIdKey || derivedIdKey

  let isDuplicateAttempt = false
  if (!disabled && idKey) {
    isDuplicateAttempt = shouldSkipRateLimitForIdempotency(idKey, 30_000)
    if (!isDuplicateAttempt) {
      const peek = peekRateLimitWithConfig(request, { maxRequests, windowMs, namespace, useIp: false })
      if (!peek.success) {
        const seconds = Math.max(1, Math.ceil((peek.resetTime - Date.now()) / 1000))
        const { host: dbHost, db: dbName } = getDbInfo()
        const res = NextResponse.json(
          { ok: false, error: `Rate limited. Please wait ${seconds}s and try again.`, cooldownSeconds: seconds },
          { status: 429 }
        )
        res.headers.set('X-Trace-Id', traceId)
        res.headers.set('X-RateLimit-Limit', String(peek.limit))
        res.headers.set('X-RateLimit-Remaining', String(peek.remaining))
        res.headers.set('X-RateLimit-Reset', String(Math.ceil(peek.resetTime / 1000)))
        res.headers.set('Retry-After', String(seconds))
        if (disabled) res.headers.set('X-RateLimit', 'disabled')
        res.headers.set('X-DB-Host', dbHost)
        res.headers.set('X-DB-Name', dbName)
        res.headers.set('X-User-Email', String(emailLower))
        res.headers.set('X-Org-Slug', orgSlug || '')
        res.headers.set('X-Org-Id', '')
        return res
      }
    }
  }

  // 6) Validate required fields
  if (!data.fullName) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: 'Full name is required' }, { status: 400 })
    if (disabled) res.headers.set('X-RateLimit', 'disabled')
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', String(emailLower))
    res.headers.set('X-Org-Slug', orgSlug || '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  // 7) Optional server-side throttle for bulk submissions
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
  try {
    const isBulkReq = !!(data as any)?.isBulk
    const batchId = String((data as any)?.bulkBatchId || '').trim()
    if (isBulkReq) {
      if (!disabled) {
        if (batchId) {
          const conflict = await sql`SELECT 1 FROM student_activity 
            WHERE LOWER(email) = ${emailLower} AND action = 'bulk_submit' 
              AND created_at > NOW() - INTERVAL '24 hours'
              AND COALESCE(metadata->>'batch_id','') <> ${batchId}
            LIMIT 1`;
          if (conflict.rows.length) {
            return NextResponse.json({ ok: false, error: 'Bulk submissions are limited to 1 per 24 hours.' }, { status: 429 })
          }
        } else {
          const conflict = await sql`SELECT 1 FROM student_activity 
            WHERE LOWER(email) = ${emailLower} AND action = 'bulk_submit' 
              AND created_at > NOW() - INTERVAL '24 hours'
            LIMIT 1`;
          if (conflict.rows.length) {
            return NextResponse.json({ ok: false, error: 'Bulk submissions are limited to 1 per 24 hours.' }, { status: 429 })
          }
        }
      }
      try {
        await sql`INSERT INTO student_activity (email, action, metadata) VALUES (
          ${emailLower}, 'bulk_submit', jsonb_build_object('batch_id', ${batchId || null}::text)
        )`;
      } catch {}
    }
  } catch {}

  // 8) Audit logging (production-safe)
  try {
    if (data.fieldOfStudy && data.areaOfInterest) {
      const auditRow = findRowForAudit(data.fieldOfStudy, data.areaOfInterest)
      const rawHash = data.suggestedVacancies ? crypto.createHash('sha256').update(data.suggestedVacancies).digest('hex') : null
      if (process.env.NODE_ENV === 'development') {
        console.log('CV_SUBMIT_AUDIT:', {
          timestamp: new Date().toISOString(),
          field: data.fieldOfStudy,
          area: data.areaOfInterest,
          rawRow: auditRow,
          suggestedVacanciesHash: rawHash,
          userEmail: emailLower
        })
      }
    }
  } catch {}

  // 9) Resolve and validate organization
  const orgSlugResolved = orgSlug
  if (!orgSlugResolved) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: 'No organization selected.' }, { status: 400 })
    res.headers.set('X-Trace-Id', traceId)
    if (disabled) res.headers.set('X-RateLimit', 'disabled')
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', String(emailLower))
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    return res
  }
  const orgRes = await sql`SELECT id::uuid as id, name FROM organizations WHERE slug = ${orgSlugResolved} LIMIT 1`
  if (!orgRes.rows.length) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: 'Organization not found' }, { status: 404 })
    res.headers.set('X-Trace-Id', traceId)
    if (disabled) res.headers.set('X-RateLimit', 'disabled')
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', String(emailLower))
    res.headers.set('X-Org-Slug', orgSlugResolved)
    res.headers.set('X-Org-Id', '')
    return res
  }
  const orgId = orgRes.rows[0].id as string
  const orgName = orgRes.rows[0].name as string

  // 10) Map fields
  const cvTypeRaw: string = (data.cvType || 'uploaded')
  const cvTypeEnum: 'uploaded' | 'ai_generated' = (cvTypeRaw === 'ai' || cvTypeRaw === 'ai_generated') ? 'ai_generated' : 'uploaded'
  const parseStatus: 'pending' | 'processing' | 'completed' | 'failed' = (cvTypeEnum === 'ai_generated') ? 'completed' : 'pending'
  const degreeTxt: string = (data.degree || data.knetProfile?.degreeBucket || data.fieldOfStudy || 'Other').toString()
  const yoeInput = (data.yearsOfExperience ?? data.knetProfile?.yearsOfExperienceBucket ?? null)
  const yoeNorm = normalizeYoE(yoeInput)
  const yoeDb = yoeNorm.replace(/[–—]/g, '-')
  const areaTxt: string | null = (data.areaOfInterest || data.knetProfile?.areaOfInterest || null)
  const areaNorm: string | null = areaTxt ? normalizeArea(areaTxt) : null
  const areaSlug: string | null = areaNorm ? areaNorm.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') : null

  // Build knet_profile JSONB for storage (best-effort)
  const degreeBucketFromSlug = String(data.degree || '').toLowerCase() === 'master'
    ? 'Master’s' : (String(data.degree || '').toLowerCase() === 'bachelor' ? 'Bachelor’s' : undefined)
  const knetProfile = {
    degreeBucket: (data.knetProfile?.degreeBucket || degreeBucketFromSlug || 'Others') as string,
    yearsOfExperienceBucket: yoeNorm as string,
    areaOfInterest: (areaNorm || areaTxt || '') as string,
    areaSlug: (data.areaSlug || areaSlug || '') as string,
    taxonomyVersion: (data.taxonomyVersion || 'v1') as string,
  }
  const cvKey: string | null = (data?.cvUrl ?? data?.cv_file_key ?? data?.cv_blob_key ?? null)

  // 10b) Persist full CV JSON and template for admin PDF + dashboard fields
  const templateForStore: string = (data.template || 'minimal')
  const suggestedVacanciesTxt: string = (data.suggestedVacancies || '')
  const suggestedVacanciesList: string[] = Array.isArray((data as any).suggestedVacanciesList)
    ? (data as any).suggestedVacanciesList
    : (suggestedVacanciesTxt
        ? String(suggestedVacanciesTxt).split(/[\/;,]+/).map((s: string) => s.trim()).filter(Boolean)
        : [])
  const cvJsonStored = {
    ...(data || {}),
    fieldOfStudy: data.fieldOfStudy || null,
    areaOfInterest: areaNorm || areaTxt || '',
    suggestedVacancies: suggestedVacanciesTxt || null,
    suggestedVacanciesList,
    template: templateForStore,
    language: (data.language || 'en'),
    knetProfile,
  }

  // Normalize GPA from payload (supports "3.8", "3.8/4", "85%") to 0..4 scale
  let gpaNum: number | null = null
  try {
    const raw = String((data?.education?.[0]?.gpa || data?.gpa || '')).trim()
    if (raw) {
      let val: number | null = null
      if (raw.includes('/')) {
        const [numStr, denStr] = raw.split('/').map((s: string) => s.trim())
        const num = parseFloat((numStr.match(/\d+(?:\.\d+)?/)||[])[0] || '')
        const den = parseFloat((denStr.match(/\d+(?:\.\d+)?/)||[])[0] || '')
        if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
          val = (num / den) * 4
        }
      } else {
        const m = raw.match(/\d+(?:\.\d+)?/)
        if (m) {
          const num = parseFloat(m[0])
          if (Number.isFinite(num)) {
            if (num > 5 && num <= 100) val = (num / 100) * 4
            else val = num
          }
        }
      }
      if (val != null && Number.isFinite(val)) {
        gpaNum = Math.max(0, Math.min(4, parseFloat(val.toFixed(2))))
      }
    }
  } catch {}

  // 11) Insert/upsert candidate per tenant
  let ins
  try {
    // Ensure JSONB column exists for profile
    try { await sql`ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS knet_profile JSONB`; } catch {}
    try { await sql`ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS cv_json JSONB`; } catch {}
    try { await sql`ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS cv_template TEXT`; } catch {}
    ins = await sql`
      INSERT INTO public.candidates (
        org_id,
        full_name,
        email,
        phone,
        field_of_study,
        area_of_interest,
        degree,
        years_of_experience,
        gpa,
        cv_type,
        cv_blob_key,
        parse_status,
        knet_profile,
        cv_json,
        cv_template
      ) VALUES (
        ${orgId}::uuid,
        ${data.fullName},
        ${emailLower},
        ${data.phone || null},
        ${data.fieldOfStudy || null},
        ${areaTxt},
        ${degreeTxt},
        CAST(${yoeDb} AS yoe_bucket),
        ${gpaNum},
        CAST(${cvTypeEnum} AS cv_type_enum),
        ${cvKey || ''},
        CAST(${parseStatus} AS parse_status_enum),
        ${JSON.stringify(knetProfile)}::jsonb,
        ${JSON.stringify(cvJsonStored)}::jsonb,
        ${templateForStore}
      )
      RETURNING id::uuid as id, created_at, parse_status::text as parse_status, cv_type::text as cv_type
    `
  } catch (e: any) {
    const msg = String(e?.message || '')
    // Return structured error with tracing
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, error: msg || 'Submission failed (insert)' }, { status: 500 })
    res.headers.set('X-Trace-Id', traceId)
    if (disabled) res.headers.set('X-RateLimit', 'disabled')
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', String(emailLower))
    res.headers.set('X-Org-Slug', orgSlugResolved)
    res.headers.set('X-Org-Id', orgId)
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  if (!disabled && !isDuplicateAttempt) {
    try { consumeRateLimitWithConfig(request, { maxRequests, windowMs, namespace, useIp: false }) } catch {}
  }

  const candidate = {
    id: ins.rows[0].id as string,
    org_id: orgId,
    org_slug: orgSlugResolved,
    org_name: orgName,
    email: emailLower,
    full_name: data.fullName,
    phone: data.phone || '',
    cv_file_key: cvKey || '',
    created_at: (ins.rows[0] as any).created_at,
    parse_status: (ins.rows[0] as any).parse_status,
    cv_type: (ins.rows[0] as any).cv_type,
  }

  // Loopback read-after-write verification
  let loopbackFound = false
  try {
    const loop = await sql`SELECT 1 FROM public.candidates WHERE id = ${ins.rows[0].id}::uuid AND org_id = ${orgId}::uuid AND email_lc = ${emailLower} LIMIT 1`
    loopbackFound = loop.rows.length > 0
  } catch {}

  const { host: dbHost, db: dbName } = getDbInfo()
  const res = NextResponse.json({ ok: true, candidate, candidate_id: candidate.id, org_slug: candidate.org_slug, email: candidate.email })
  res.headers.set('X-Trace-Id', traceId)
  if (disabled) res.headers.set('X-RateLimit', 'disabled')
  res.headers.set('X-DB-Host', dbHost)
  res.headers.set('X-DB-Name', dbName)
  res.headers.set('X-User-Email', String(emailLower))
  res.headers.set('X-Org-Slug', orgSlugResolved)
  res.headers.set('X-Org-Id', orgId)
  res.headers.set('X-Loopback-Found', loopbackFound ? 'true' : 'false')

  // Auto-parse uploaded CVs (always enabled for better UX)
  // Only parse if there's a CV file to parse
  if (cvKey && cvTypeEnum === 'uploaded') {
    try {
      const internal = (process.env.INTERNAL_API_TOKEN || '').trim()
      const parseUrl = new URL(`/api/${orgSlugResolved}/admin/cv/parse/${candidate.id}`, request.url).toString()
      console.log('[SUBMIT] Triggering auto-parse for candidate:', candidate.id)
      // Fire-and-forget parsing
      fetch(parseUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(internal ? { 'x-internal-token': internal } : {}) },
        body: JSON.stringify({})
      }).catch((err) => console.error('[SUBMIT] Auto-parse trigger failed:', err))
    } catch (err) {
      console.error('[SUBMIT] Auto-parse setup failed:', err)
    }
  }

  return res
}
