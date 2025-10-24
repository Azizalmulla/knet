import { NextResponse } from 'next/server';
import { sql, getDbInfo } from '@/lib/db';

export async function GET(request: Request) {
  // Check admin authorization via x-admin-key header with trimming
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  const allowed = [envKey, fallback].filter(Boolean);
  if (!provided || !allowed.includes(provided)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Org scoping for multi-tenant candidates read (supports header or query param)
  const url = new URL(request.url)
  const orgFromQuery = (url.searchParams.get('org') || '').trim()
  const orgFromHeader = (request.headers.get('x-org-slug') || '').trim()
  const orgSlug = orgFromHeader || orgFromQuery

  const USE_CANDIDATES_ONLY = String(process.env.USE_CANDIDATES_ONLY || '').toLowerCase() === 'true'
  const FALLBACK_STUDENTS_READ = String(process.env.FALLBACK_STUDENTS_READ || '').toLowerCase() === 'true'

  // Optional server-side filters (kept minimal for global route)
  const qp = (k: string) => (url.searchParams.get(k) || '').trim()
  const search = qp('search')
  const limit = Math.max(1, Math.min(200, parseInt(qp('limit') || '100', 10) || 100))
  const offset = Math.max(0, parseInt(qp('offset') || '0', 10) || 0)

  try {
    // Prefer candidates if table exists and org slug provided
    let hasCandidates = false
    try {
      const reg = await sql<{ c: string | null }>`SELECT to_regclass('public.candidates') as c`
      hasCandidates = !!reg.rows?.[0]?.c
    } catch {}

    if (hasCandidates && orgSlug) {
      // Resolve org id from slug
      const org = await sql`SELECT id::uuid as id FROM public.organizations WHERE slug = ${orgSlug} LIMIT 1`
      if (!org.rows.length) {
        return NextResponse.json({ students: [], warning: 'Organization not found' }, { headers: { 'Cache-Control': 'no-store' } })
      }
      const orgId = org.rows[0].id as string

      // Build simple WHERE with search
      const conds: string[] = ['c.org_id = $1']
      const values: any[] = [orgId]
      let p = 2
      if (search) { conds.push(`(LOWER(c.full_name) LIKE $${p} OR LOWER(c.email) LIKE $${p})`); values.push(`%${search.toLowerCase()}%`); p++ }
      const whereSQL = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

      const q = `
        SELECT 
          c.id::text AS id,
          c.full_name,
          c.email,
          COALESCE(c.phone, '') AS phone,
          COALESCE(c.field_of_study, '') AS field_of_study,
          COALESCE(c.area_of_interest, '') AS area_of_interest,
          (CASE WHEN c.cv_type::text = 'ai_generated' THEN 'ai' ELSE 'uploaded' END) AS cv_type,
          '' AS cv_url,
          (CASE 
            WHEN NULLIF(c.cv_blob_key,'') IS NOT NULL THEN true
            WHEN c.cv_json IS NOT NULL AND c.cv_type::text = 'ai_generated' THEN true
            ELSE false 
          END) AS has_cv,
          COALESCE(c.cv_json->>'suggestedVacancies', NULL) AS suggested_vacancies,
          COALESCE(
            CASE 
              WHEN jsonb_typeof(c.cv_json->'suggestedVacanciesList') = 'array' THEN (
                SELECT ARRAY(SELECT jsonb_array_elements_text(c.cv_json->'suggestedVacanciesList'))
              )
              WHEN COALESCE(c.cv_json->>'suggestedVacancies','') <> '' THEN string_to_array(replace(c.cv_json->>'suggestedVacancies',';','/'), '/')
              ELSE ARRAY[]::text[]
            END,
            ARRAY[]::text[]
          ) AS suggested_vacancies_list,
          COALESCE(c.created_at, NOW()) AS submitted_at,
          COALESCE(c.gpa, NULL) AS gpa,
          COALESCE(c.parse_status::text, 'queued') AS cv_parse_status,
          COALESCE(c.years_of_experience, NULL) AS years_of_experience,
          jsonb_build_object(
            'degreeBucket', COALESCE(c.degree, c.knet_profile->>'degreeBucket'),
            'yearsOfExperienceBucket', COALESCE((c.years_of_experience)::text, c.knet_profile->>'yearsOfExperienceBucket'),
            'areaOfInterest', COALESCE(c.area_of_interest, c.knet_profile->>'areaOfInterest')
          ) AS knet_profile,
          COALESCE(c.cv_json, NULL) AS cv_json
        FROM public.candidates c
        ${whereSQL}
        ORDER BY c.created_at DESC NULLS LAST
        OFFSET $${p}
        LIMIT $${p+1}
      `
      const result = await sql.query(q, [...values, offset, limit])
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ students: result.rows }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-List-Count': String(result.rowCount || 0)
        }
      })
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-Org-Slug', orgSlug)
      res.headers.set('X-Org-Id', orgId)
      return res
    }

    if (USE_CANDIDATES_ONLY) {
      // Hard require org slug when candidates-only mode is enabled
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ students: [], error: 'Organization slug is required (org=) when candidates-only mode is enabled.' }, { status: 400 })
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      return res
    }

    // Legacy fallback: students table (optionally filter by org_slug if present)
    if (FALLBACK_STUDENTS_READ || !hasCandidates) {
      // Ensure required columns exist (idempotent)
      try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS gpa NUMERIC(3,2)`; } catch {}
      try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_parse_status TEXT DEFAULT 'queued'`; } catch {}
      try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS years_of_experience TEXT`; } catch {}
      try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS knet_profile JSONB`; } catch {}
      try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_json JSONB`; } catch {}

      const conds: string[] = []
      const values: any[] = []
      let p = 1
      if (orgSlug) { conds.push(`s.org_slug = $${p}`); values.push(orgSlug); p++ }
      if (search) { conds.push(`(LOWER(s.full_name) LIKE $${p} OR LOWER(s.email) LIKE $${p})`); values.push(`%${search.toLowerCase()}%`); p++ }
      const whereSQL = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

      const q = `
        SELECT 
          s.id::int AS id,
          s.full_name,
          s.email,
          COALESCE(s.phone, '') AS phone,
          COALESCE(s.field_of_study, '') AS field_of_study,
          COALESCE(s.area_of_interest, '') AS area_of_interest,
          COALESCE(s.cv_type, 'uploaded') AS cv_type,
          COALESCE(s.cv_url, '') AS cv_url,
          (CASE WHEN COALESCE(NULLIF(s.cv_url,'')) IS NULL THEN false ELSE true END) AS has_cv,
          COALESCE(s.suggested_vacancies, NULL) AS suggested_vacancies,
          COALESCE(s.suggested_vacancies_list, '{}') AS suggested_vacancies_list,
          COALESCE(s.submitted_at, NOW()) AS submitted_at,
          COALESCE(s.gpa, NULL) AS gpa,
          COALESCE(s.cv_parse_status, 'queued') AS cv_parse_status,
          COALESCE(s.years_of_experience, NULL) AS years_of_experience,
          COALESCE(s.knet_profile, NULL) AS knet_profile,
          COALESCE(s.cv_json, NULL) AS cv_json
        FROM public.students s
        ${whereSQL}
        ORDER BY s.submitted_at DESC NULLS LAST
        OFFSET $${p}
        LIMIT $${p+1}
      `
      const result = await sql.query(q, [...values, offset, limit])
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ students: result.rows }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-List-Count': String(result.rowCount || 0)
        }
      })
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      if (orgSlug) res.headers.set('X-Org-Slug', orgSlug)
      return res
    }

    // If neither path taken, return empty
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ students: [] }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-List-Count': '0' } })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    return res
  } catch (error) {
    console.error('Failed to fetch students:', error);
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ error: 'Failed to fetch students' }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-List-Count': '0' } })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    return res
  }
}
