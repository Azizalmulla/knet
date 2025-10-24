import { NextRequest, NextResponse } from 'next/server'
import { sql, getDbInfo } from '@/lib/db'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Returns student-owned submissions with pagination.
// Query params:
// - mode: 'selected' | 'all' (default 'selected')
// - org: slug required for mode=selected
// - offset: number (default 0)
// - limit: number (default 30, max 100)
export async function GET(req: NextRequest) {
  // Resolve user email from Supabase ONLY (ignore admin/superadmin cookies)
  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}
  if (!emailLower) {
    return NextResponse.json({ error: 'Not logged in. Please log in to view submissions.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  let mode = (searchParams.get('mode') || 'selected').toLowerCase()
  let org = (searchParams.get('org') || '').trim()
  // If client asked for selected without an org, default to all
  if (mode === 'selected' && !org) {
    mode = 'all'
  }
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0)
  const limitRaw = parseInt(searchParams.get('limit') || '30', 10)
  const limit = Math.max(1, Math.min(100, isFinite(limitRaw) ? limitRaw : 30))

  // Filters & sorting (single-value for simplicity)
  const statusParam = (searchParams.get('status') || '').toLowerCase()
  const allowedStatuses = new Set(['pending','processing','completed','failed'])
  const statusSingle = (statusParam.split(',').map(s => s.trim()).find(s => allowedStatuses.has(s)) || '')

  const cvTypeParam = (searchParams.get('cvType') || '').toLowerCase()
  const cvTypeSingleRaw = (cvTypeParam.split(',').map(s => s.trim()).find(s => s === 'uploaded' || s === 'ai' || s === 'ai_generated') || '')
  const cvTypeSingle = cvTypeSingleRaw === 'ai' ? 'ai_generated' : cvTypeSingleRaw

  const decisionParam = (searchParams.get('decision') || '').toLowerCase()
  const allowedDecisions = new Set(['pending','shortlisted','rejected','interviewed','hired'])
  const decisionSingle = (decisionParam.split(',').map(s => s.trim()).find(s => allowedDecisions.has(s)) || '')

  const startStr = (searchParams.get('start') || '').trim() // YYYY-MM-DD
  const endStr = (searchParams.get('end') || '').trim()     // YYYY-MM-DD
  const startISO = startStr ? new Date(startStr + 'T00:00:00Z').toISOString() : null
  const endISO = endStr ? new Date(new Date(endStr + 'T00:00:00Z').getTime() + 24*60*60*1000).toISOString() : null // next day (exclusive)

  const orderParam = (searchParams.get('order') || 'desc').toLowerCase()
  const order = orderParam === 'asc' ? 'asc' : 'desc'

  // Debug info for development
  let debugInfo: any = null
  if (process.env.NODE_ENV === 'development') {
    debugInfo = {
      user: emailLower,
      org: mode === 'all' ? 'all_orgs' : org,
      mode,
      filters: {
        status: statusSingle || 'none',
        cvType: cvTypeSingle || 'none',
        decision: decisionSingle || 'none',
        dateRange: startStr && endStr ? `${startStr} to ${endStr}` : 'none'
      },
      pagination: { offset, limit, order }
    }
  }

  try {
    // Enrich debug with orgId if available
    if (debugInfo && mode === 'selected' && org) {
      try {
        const orgRow = await sql<{ id: string }>`SELECT id::uuid as id FROM organizations WHERE slug = ${org} LIMIT 1`
        ;(debugInfo as any).orgId = orgRow.rows?.[0]?.id || null
      } catch {}
    }
    const { host: dbHost, db: dbName } = getDbInfo()
    const orgSlugHeader = mode === 'all' ? 'all_orgs' : org
    const orgIdHeader = (debugInfo && (debugInfo as any).orgId) || ''
    if (mode === 'all') {
      // Candidates only, ignore org filter in All mode
      let cand
      if (order === 'asc') {
        cand = await sql`
          SELECT 
            c.id::text,
            c.full_name AS name,
            c.email,
            COALESCE(c.phone, '') AS phone,
            COALESCE(c.cv_blob_key, '') AS cv_file_key,
            COALESCE(c.created_at, NOW()) AS created_at,
            COALESCE(c.parse_status::text, 'completed') AS parse_status,
            COALESCE(c.cv_type::text, NULL) AS cv_type,
            NULL::jsonb AS knet_profile,
            COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
            COALESCE(d.status, 'pending') AS decision_status,
            o.id::uuid AS org_id,
            COALESCE(o.name, o.slug) AS org_name,
            COALESCE(o.slug, '') AS org_slug,
            COALESCE(o.logo_url, NULL)::text AS org_logo
          FROM public.candidates c
          LEFT JOIN organizations o ON o.id = c.org_id
          LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
          LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
          WHERE c.email_lc = ${emailLower}
            AND COALESCE(c.deleted_at, NULL) IS NULL
            AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
            AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
            AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
            AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
            AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
          ORDER BY c.created_at ASC NULLS LAST
          OFFSET ${offset}
          LIMIT ${limit}
        `
      } else {
        cand = await sql`
          SELECT 
            c.id::text,
            c.full_name AS name,
            c.email,
            COALESCE(c.phone, '') AS phone,
            COALESCE(c.cv_blob_key, '') AS cv_file_key,
            COALESCE(c.created_at, NOW()) AS created_at,
            COALESCE(c.parse_status::text, 'completed') AS parse_status,
            COALESCE(c.cv_type::text, NULL) AS cv_type,
            NULL::jsonb AS knet_profile,
            COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
            COALESCE(d.status, 'pending') AS decision_status,
            COALESCE(o.name, o.slug) AS org_name,
            COALESCE(o.slug, '') AS org_slug,
            COALESCE(o.logo_url, NULL)::text AS org_logo
          FROM public.candidates c
          LEFT JOIN organizations o ON o.id = c.org_id
          LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
          LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
          WHERE c.email_lc = ${emailLower}
            AND COALESCE(c.deleted_at, NULL) IS NULL
            AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
            AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
            AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
            AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
            AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
          ORDER BY c.created_at DESC NULLS LAST
          OFFSET ${offset}
          LIMIT ${limit}
        `
      }
      const rows = cand.rows || []
      if (debugInfo) {
        debugInfo.rowsReturned = rows.length
        debugInfo.queryMode = 'all_orgs'
      }
      const response = debugInfo 
        ? { submissions: rows, debug: debugInfo }
        : { submissions: rows }
      const res = new NextResponse(JSON.stringify(response), { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json', 
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-List-Count': String(rows.length)
        } 
      })
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', orgSlugHeader)
      res.headers.set('X-Org-Id', orgIdHeader)
      return res
    }

    // Selected org mode requires org
    if (!org) {
      return NextResponse.json({ error: 'Missing org' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    let cand
    if (order === 'asc') {
      cand = await sql`
      SELECT 
        c.id::text,
        c.full_name AS name,
        c.email,
        COALESCE(c.phone, '') AS phone,
        COALESCE(c.cv_blob_key, '') AS cv_file_key,
        COALESCE(c.created_at, NOW()) AS created_at,
        COALESCE(c.parse_status::text, 'completed') AS parse_status,
        COALESCE(c.cv_type::text, NULL) AS cv_type,
        NULL::jsonb AS knet_profile,
        COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
        COALESCE(d.status, 'pending') AS decision_status,
        o.id::uuid AS org_id,
        COALESCE(o.name, o.slug) AS org_name,
        COALESCE(o.slug, '') AS org_slug,
        COALESCE(o.logo_url, NULL)::text AS org_logo
      FROM public.candidates c
      LEFT JOIN organizations o ON o.id = c.org_id
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
      LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
      WHERE c.email_lc = ${emailLower}
        AND o.slug = ${org}
        AND COALESCE(c.deleted_at, NULL) IS NULL
        AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
        AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
        AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
        AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
        AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
      ORDER BY c.created_at ASC NULLS LAST
      OFFSET ${offset}
      LIMIT ${limit}
    `
    } else {
      cand = await sql`
      SELECT 
        c.id::text,
        c.full_name AS name,
        c.email,
        COALESCE(c.phone, '') AS phone,
        COALESCE(c.cv_blob_key, '') AS cv_file_key,
        COALESCE(c.created_at, NOW()) AS created_at,
        COALESCE(c.parse_status::text, 'completed') AS parse_status,
        COALESCE(c.cv_type::text, NULL) AS cv_type,
        NULL::jsonb AS knet_profile,
        COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
        COALESCE(d.status, 'pending') AS decision_status,
        o.id::uuid AS org_id,
        COALESCE(o.name, o.slug) AS org_name,
        COALESCE(o.slug, '') AS org_slug,
        COALESCE(o.logo_url, NULL)::text AS org_logo
      FROM public.candidates c
      LEFT JOIN organizations o ON o.id = c.org_id
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
      LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
      WHERE c.email_lc = ${emailLower}
        AND o.slug = ${org}
        AND COALESCE(c.deleted_at, NULL) IS NULL
        AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
        AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
        AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
        AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
        AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
      ORDER BY c.created_at DESC NULLS LAST
      OFFSET ${offset}
      LIMIT ${limit}
    `
    }
    const rows = cand.rows || []
    if (debugInfo) {
      debugInfo.rowsReturned = rows.length
      debugInfo.queryMode = 'selected_org'
      debugInfo.orgSlug = org
    }
    const response = debugInfo 
      ? { submissions: rows, debug: debugInfo }
      : { submissions: rows }
    const res = new NextResponse(JSON.stringify(response), { 
      status: 200, 
      headers: { 
        'Content-Type': 'application/json', 
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-List-Count': String(rows.length)
      } 
    })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', orgSlugHeader)
    res.headers.set('X-Org-Id', orgIdHeader)
    return res
  } catch (error) {
    console.error('Failed to list student submissions:', error)
    const errorResponse = debugInfo 
      ? { submissions: [], debug: { ...debugInfo, error: String(error), rowsReturned: 0 } }
      : { submissions: [] }
    const { host: dbHost, db: dbName } = getDbInfo()
    const orgSlugHeader = mode === 'all' ? 'all_orgs' : org
    const orgIdHeader = (debugInfo && (debugInfo as any).orgId) || ''
    const res = NextResponse.json(errorResponse, { 
      headers: { 
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-List-Count': '0'
      } 
    })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', orgSlugHeader)
    res.headers.set('X-Org-Id', orgIdHeader)
    return res
  }
}
