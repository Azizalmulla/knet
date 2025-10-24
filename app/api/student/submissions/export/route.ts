import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { createServerClient } from '@/lib/supabase-server'

function csvEscape(val: any): string {
  let s = (val ?? '').toString()
  // Excel/Sheets formula injection guard
  if (s && ['=', '+', '-', '@'].includes(s[0])) {
    s = "'" + s // prefix with apostrophe to force literal
  }
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function mapCvType(t?: string | null): string {
  const v = (t || '').toLowerCase()
  if (v === 'ai' || v === 'ai_generated') return 'ai-built'
  if (v === 'uploaded') return 'uploaded'
  return ''
}

export async function GET(req: NextRequest) {
  // Supabase first, then NextAuth (same as list endpoint)
  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}
  if (!emailLower) {
    const session = await getServerSession()
    const email = session?.user?.email
    if (email) emailLower = email.toLowerCase()
  }
  if (!emailLower) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  let mode = (searchParams.get('mode') || 'selected').toLowerCase() as 'selected' | 'all'
  let org = (searchParams.get('org') || '').trim()
  if (mode === 'selected' && !org) {
    mode = 'all'
  }
  const statusParam = (searchParams.get('status') || '').toLowerCase()
  const allowedStatuses = new Set(['pending','processing','completed','failed'])
  const statusSingle = (statusParam.split(',').map(s => s.trim()).find(s => allowedStatuses.has(s)) || '')
  const cvTypeParam = (searchParams.get('cvType') || '').toLowerCase()
  const cvTypeSingleRaw = (cvTypeParam.split(',').map(s => s.trim()).find(s => s === 'uploaded' || s === 'ai' || s === 'ai_generated') || '')
  const cvTypeSingle = cvTypeSingleRaw === 'ai' ? 'ai_generated' : cvTypeSingleRaw
  const decisionParam = (searchParams.get('decision') || '').toLowerCase()
  const allowedDecisions = new Set(['pending','shortlisted','rejected','interviewed','hired'])
  const decisionSingle = (decisionParam.split(',').map(s => s.trim()).find(s => allowedDecisions.has(s)) || '')
  const startStr = (searchParams.get('start') || '').trim()
  const endStr = (searchParams.get('end') || '').trim()
  const startISO = startStr ? new Date(startStr + 'T00:00:00Z').toISOString() : null
  const endISO = endStr ? new Date(new Date(endStr + 'T00:00:00Z').getTime() + 24*60*60*1000).toISOString() : null
  const orderParam = (searchParams.get('order') || 'desc').toLowerCase()
  const order = orderParam === 'asc' ? 'asc' : 'desc'

  try {
    const exists = await sql<{ c: string | null }>`SELECT to_regclass('public.candidates') as c`;
    const hasCandidates = !!exists.rows?.[0]?.c

    let rows: Array<{ org_name: string; org_slug: string; org_id: string | null; cv_type: string | null; status: string; submitted_at: string; ai_feedback: string; decision: string; decision_date: string | null }>
      = []

    if (mode === 'all') {
      if (hasCandidates) {
        let cand
        if (order === 'asc') {
          cand = await sql`
            SELECT 
              COALESCE(o.name, o.slug) AS org_name,
              COALESCE(o.slug, '') AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(c.cv_type::text, NULL) AS cv_type,
              COALESCE(c.parse_status::text, 'completed') AS status,
              COALESCE(c.created_at, NOW()) AS submitted_at,
              COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
              COALESCE(d.status, 'pending') AS decision,
              COALESCE(d.updated_at, NULL)::timestamptz AS decision_date
            FROM public.candidates c
            LEFT JOIN organizations o ON o.id = c.org_id
            LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
            LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
            WHERE LOWER(c.email) = ${emailLower}
              AND COALESCE(c.deleted_at, NULL) IS NULL
              AND (${org} = '' OR o.slug = ${org})
              AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
              AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
            ORDER BY c.created_at ASC NULLS LAST
            LIMIT 5000
          `
        } else {
          cand = await sql`
            SELECT 
              COALESCE(o.name, o.slug) AS org_name,
              COALESCE(o.slug, '') AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(c.cv_type::text, NULL) AS cv_type,
              COALESCE(c.parse_status::text, 'completed') AS status,
              COALESCE(c.created_at, NOW()) AS submitted_at,
              COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
              COALESCE(d.status, 'pending') AS decision,
              COALESCE(d.updated_at, NULL)::timestamptz AS decision_date
            FROM public.candidates c
            LEFT JOIN organizations o ON o.id = c.org_id
            LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
            LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
            WHERE LOWER(c.email) = ${emailLower}
              AND COALESCE(c.deleted_at, NULL) IS NULL
              AND (${org} = '' OR o.slug = ${org})
              AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
              AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
            ORDER BY c.created_at DESC NULLS LAST
            LIMIT 5000
          `
        }
        rows = cand.rows as any
      } else {
        let stu
        if (order === 'asc') {
          stu = await sql`
            SELECT 
              COALESCE(o.name, s.org_slug) AS org_name,
              COALESCE(o.slug, s.org_slug) AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(s.cv_type, NULL) AS cv_type,
              COALESCE(s.cv_parse_status, 'completed') AS status,
              COALESCE(s.submitted_at, NOW()) AS submitted_at,
              COALESCE(s.knet_profile->>'ai_feedback','') AS ai_feedback,
              COALESCE(s.knet_profile->>'decision_status','pending') AS decision,
              NULL::timestamptz AS decision_date
            FROM public.students s
            LEFT JOIN organizations o ON o.slug = s.org_slug
            WHERE LOWER(s.email) = ${emailLower}
              AND (${org} = '' OR s.org_slug = ${org})
              AND (${statusSingle} = '' OR s.cv_parse_status = ${statusSingle} OR (s.cv_parse_status = 'done' AND ${statusSingle} = 'completed'))
              AND (${cvTypeSingle} = '' OR s.cv_type = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(s.knet_profile->>'decision_status','pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR s.submitted_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR s.submitted_at < ${endISO}::timestamptz)
            ORDER BY s.submitted_at ASC NULLS LAST
            LIMIT 5000
          `
        } else {
          stu = await sql`
            SELECT 
              COALESCE(o.name, s.org_slug) AS org_name,
              COALESCE(o.slug, s.org_slug) AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(s.cv_type, NULL) AS cv_type,
              COALESCE(s.cv_parse_status, 'completed') AS status,
              COALESCE(s.submitted_at, NOW()) AS submitted_at,
              COALESCE(s.knet_profile->>'ai_feedback','') AS ai_feedback,
              COALESCE(s.knet_profile->>'decision_status','pending') AS decision,
              NULL::timestamptz AS decision_date
            FROM public.students s
            LEFT JOIN organizations o ON o.slug = s.org_slug
            WHERE LOWER(s.email) = ${emailLower}
              AND (${org} = '' OR s.org_slug = ${org})
              AND (${statusSingle} = '' OR s.cv_parse_status = ${statusSingle} OR (s.cv_parse_status = 'done' AND ${statusSingle} = 'completed'))
              AND (${cvTypeSingle} = '' OR s.cv_type = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(s.knet_profile->>'decision_status','pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR s.submitted_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR s.submitted_at < ${endISO}::timestamptz)
            ORDER BY s.submitted_at DESC NULLS LAST
            LIMIT 5000
          `
        }
        rows = stu.rows as any
      }
    } else {
      if (!org) return new NextResponse('Missing org', { status: 400 })
      if (hasCandidates) {
        let cand
        if (order === 'asc') {
          cand = await sql`
            SELECT 
              COALESCE(o.name, o.slug) AS org_name,
              COALESCE(o.slug, '') AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(c.cv_type::text, NULL) AS cv_type,
              COALESCE(c.parse_status::text, 'completed') AS status,
              COALESCE(c.created_at, NOW()) AS submitted_at,
              COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
              COALESCE(d.status, 'pending') AS decision,
              COALESCE(d.updated_at, NULL)::timestamptz AS decision_date
            FROM public.candidates c
            LEFT JOIN organizations o ON o.id = c.org_id
            LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
            LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
            WHERE LOWER(c.email) = ${emailLower}
              AND o.slug = ${org}
              AND COALESCE(c.deleted_at, NULL) IS NULL
              AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
              AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
            ORDER BY c.created_at ASC NULLS LAST
            LIMIT 5000
          `
        } else {
          cand = await sql`
            SELECT 
              COALESCE(o.name, o.slug) AS org_name,
              COALESCE(o.slug, '') AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(c.cv_type::text, NULL) AS cv_type,
              COALESCE(c.parse_status::text, 'completed') AS status,
              COALESCE(c.created_at, NOW()) AS submitted_at,
              COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
              COALESCE(d.status, 'pending') AS decision,
              COALESCE(d.updated_at, NULL)::timestamptz AS decision_date
            FROM public.candidates c
            LEFT JOIN organizations o ON o.id = c.org_id
            LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id AND a.org_id = o.id
            LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id AND d.org_id = o.id
            WHERE LOWER(c.email) = ${emailLower}
              AND o.slug = ${org}
              AND COALESCE(c.deleted_at, NULL) IS NULL
              AND (${statusSingle} = '' OR c.parse_status::text = ${statusSingle})
              AND (${cvTypeSingle} = '' OR c.cv_type::text = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(d.status,'pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR c.created_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR c.created_at < ${endISO}::timestamptz)
            ORDER BY c.created_at DESC NULLS LAST
            LIMIT 5000
          `
        }
        rows = cand.rows as any
      } else {
        let stu
        if (order === 'asc') {
          stu = await sql`
            SELECT 
              COALESCE(o.name, s.org_slug) AS org_name,
              COALESCE(o.slug, s.org_slug) AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(s.cv_type, NULL) AS cv_type,
              COALESCE(s.cv_parse_status, 'completed') AS status,
              COALESCE(s.submitted_at, NOW()) AS submitted_at,
              COALESCE(s.knet_profile->>'ai_feedback','') AS ai_feedback,
              COALESCE(s.knet_profile->>'decision_status','pending') AS decision,
              NULL::timestamptz AS decision_date
            FROM public.students s
            LEFT JOIN organizations o ON o.slug = s.org_slug
            WHERE LOWER(s.email) = ${emailLower} AND s.org_slug = ${org}
              AND (${statusSingle} = '' OR s.cv_parse_status = ${statusSingle} OR (s.cv_parse_status = 'done' AND ${statusSingle} = 'completed'))
              AND (${cvTypeSingle} = '' OR s.cv_type = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(s.knet_profile->>'decision_status','pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR s.submitted_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR s.submitted_at < ${endISO}::timestamptz)
            ORDER BY s.submitted_at ASC NULLS LAST
            LIMIT 5000
          `
        } else {
          stu = await sql`
            SELECT 
              COALESCE(o.name, s.org_slug) AS org_name,
              COALESCE(o.slug, s.org_slug) AS org_slug,
              o.id::uuid AS org_id,
              COALESCE(s.cv_type, NULL) AS cv_type,
              COALESCE(s.cv_parse_status, 'completed') AS status,
              COALESCE(s.submitted_at, NOW()) AS submitted_at,
              COALESCE(s.knet_profile->>'ai_feedback','') AS ai_feedback,
              COALESCE(s.knet_profile->>'decision_status','pending') AS decision,
              NULL::timestamptz AS decision_date
            FROM public.students s
            LEFT JOIN organizations o ON o.slug = s.org_slug
            WHERE LOWER(s.email) = ${emailLower} AND s.org_slug = ${org}
              AND (${statusSingle} = '' OR s.cv_parse_status = ${statusSingle} OR (s.cv_parse_status = 'done' AND ${statusSingle} = 'completed'))
              AND (${cvTypeSingle} = '' OR s.cv_type = ${cvTypeSingle})
              AND (${decisionSingle} = '' OR COALESCE(s.knet_profile->>'decision_status','pending') = ${decisionSingle})
              AND (${startISO}::timestamptz IS NULL OR s.submitted_at >= ${startISO}::timestamptz)
              AND (${endISO}::timestamptz IS NULL OR s.submitted_at < ${endISO}::timestamptz)
            ORDER BY s.submitted_at DESC NULLS LAST
            LIMIT 5000
          `
        }
        rows = stu.rows as any
      }
    }

    // Build CSV
    const header = ['org_name','org_slug','org_id','cv_type','status','submitted_at','ai_feedback','decision','decision_date_utc']
    const lines: string[] = []
    lines.push(header.join(','))
    for (const r of rows) {
      const line = [
        csvEscape(r.org_name),
        csvEscape(r.org_slug || ''),
        csvEscape(r.org_id || ''),
        csvEscape(mapCvType(r.cv_type)),
        csvEscape((r.status || '').toLowerCase()),
        csvEscape(new Date(r.submitted_at).toISOString()),
        csvEscape(r.ai_feedback || ''),
        csvEscape((r.decision || 'pending').toLowerCase()),
        csvEscape(r.decision_date ? new Date(r.decision_date).toISOString() : '')
      ].join(',')
      lines.push(line)
    }
    const body = lines.join('\n')
    const filename = `career-dashboard-export-${new Date().toISOString().slice(0,10)}.csv`
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (e) {
    console.error('student export error', e)
    return new NextResponse('Export failed', { status: 500 })
  }
}
