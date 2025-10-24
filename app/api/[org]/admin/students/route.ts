// Avoid importing next/server to keep Jest environment simple
import { sql } from '@vercel/postgres'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET(request: Request, { params }: { params: { org: string } }) {
  const started = Date.now()
  const orgSlug = params.org

  // Query params (optional server filters)
  const url = new URL(request.url)
  const qp = (k: string) => (url.searchParams.get(k) || '').trim()
  const search = qp('search')
  const field = qp('field')
  const area = qp('area')
  const degree = qp('degree')
  const yoe = qp('yoe')
  const cvType = qp('cvType') // 'uploaded' | 'ai'
  const parseStatus = qp('parseStatus')
  const from = qp('from')
  const to = qp('to')
  const limit = Math.max(1, Math.min(200, parseInt(qp('limit') || '100', 10) || 100))
  const offset = Math.max(0, parseInt(qp('offset') || '0', 10) || 0)

  const USE_CANDIDATES_ONLY = String(process.env.USE_CANDIDATES_ONLY || '').toLowerCase() === 'true'
  const FALLBACK_STUDENTS_READ = String(process.env.FALLBACK_STUDENTS_READ || '').toLowerCase() === 'true'

  try {
    // Detect candidates table
    const exists = await sql<{ c: string | null }>`SELECT to_regclass('public.candidates') as c`;
    const hasCandidates = !!exists.rows?.[0]?.c

    // Build dynamic WHERE for candidates with strict org scoping via join
    if (hasCandidates) {
      // Detect optional decisions table
      let hasDecisions = false
      try {
        const decReg = await sql<{ c: string | null }>`SELECT to_regclass('public.candidate_decisions') as c`
        hasDecisions = !!decReg.rows?.[0]?.c
      } catch {}
      const decisionsSelect = hasDecisions ? `
          COALESCE(d.status, 'pending') AS decision_status,
          COALESCE(d.reason, '') AS decision_reason,
          COALESCE(d.updated_at, NULL)::timestamptz AS decision_date
        ` : `
          'pending' AS decision_status,
          '' AS decision_reason,
          NULL::timestamptz AS decision_date
        `
      const decisionsJoin = hasDecisions ? `LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id` : ''
      const conds: string[] = ['o.slug = $1']
      const values: any[] = [orgSlug]
      let p = 2
      if (search) { conds.push(`(LOWER(c.full_name) LIKE $${p} OR LOWER(c.email) LIKE $${p})`); values.push(`%${search.toLowerCase()}%`); p++ }
      if (field) { conds.push(`c.field_of_study = $${p}`); values.push(field); p++ }
      if (area) { conds.push(`c.area_of_interest = $${p}`); values.push(area); p++ }
      if (degree) { conds.push(`(c.degree = $${p} OR (c.knet_profile->>'degreeBucket') = $${p})`); values.push(degree); p++ }
      if (yoe) {
        conds.push(`(c.years_of_experience = CAST($${p} AS yoe_bucket) OR (c.knet_profile->>'yearsOfExperienceBucket') = $${p+1})`)
        values.push(yoe)
        values.push(yoe)
        p += 2
      }
      if (cvType) { conds.push(`(CASE WHEN c.cv_type::text = 'ai_generated' THEN 'ai' ELSE 'uploaded' END) = $${p}`); values.push(cvType); p++ }
      if (parseStatus) { conds.push(`c.parse_status::text = $${p}`); values.push(parseStatus); p++ }
      if (from) { conds.push(`c.created_at >= $${p}`); values.push(new Date(from)); p++ }
      if (to) { conds.push(`c.created_at <= $${p}`); values.push(new Date(to)); p++ }

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
          (CASE WHEN NULLIF(c.cv_blob_key,'') IS NULL THEN false ELSE true END) AS has_cv,
          NULL AS suggested_vacancies,
          ARRAY[]::text[] AS suggested_vacancies_list,
          COALESCE(c.created_at, NOW()) AS submitted_at,
          COALESCE(c.gpa, NULL) AS gpa,
          COALESCE(c.parse_status::text, 'queued') AS cv_parse_status,
          COALESCE(c.years_of_experience, NULL) AS years_of_experience,
          jsonb_build_object(
            'degreeBucket', COALESCE(c.degree, c.knet_profile->>'degreeBucket'),
            'yearsOfExperienceBucket', COALESCE((c.years_of_experience)::text, c.knet_profile->>'yearsOfExperienceBucket'),
            'areaOfInterest', COALESCE(c.area_of_interest, c.knet_profile->>'areaOfInterest')
          ) AS knet_profile,
          COALESCE(c.cv_json, NULL) AS cv_json,
          ${decisionsSelect}
        FROM public.candidates c
        JOIN organizations o ON o.id = c.org_id
        ${decisionsJoin}
        ${whereSQL}
        ORDER BY c.created_at DESC NULLS LAST
        OFFSET $${p}
        LIMIT $${p+1}
      `
      const result = await sql.query(q, [...values, offset, limit])
      const took = Date.now() - started
      console.log('[ADMIN_QUERY]', JSON.stringify({ org_slug: orgSlug, took_ms: took, rows: result.rowCount, filters: { search, field, area, degree, yoe, cvType, parseStatus, from, to, offset, limit }, source: 'candidates' }))

      if (result.rowCount || USE_CANDIDATES_ONLY) {
        return new Response(JSON.stringify({ students: result.rows }), { headers: { 'content-type': 'application/json' } })
      }
    }

    // Optional fallback to students (legacy)
    if (FALLBACK_STUDENTS_READ && !USE_CANDIDATES_ONLY) {
      const conds: string[] = ['s.org_slug = $1']
      const values: any[] = [orgSlug]
      let p = 2
      if (search) { conds.push(`(LOWER(s.full_name) LIKE $${p} OR LOWER(s.email) LIKE $${p})`); values.push(`%${search.toLowerCase()}%`); p++ }
      if (field) { conds.push(`s.field_of_study = $${p}`); values.push(field); p++ }
      if (area) { conds.push(`s.area_of_interest = $${p}`); values.push(area); p++ }
      if (degree) { conds.push(`(s.knet_profile->>'degreeBucket') = $${p}`); values.push(degree); p++ }
      if (yoe) { conds.push(`(s.knet_profile->>'yearsOfExperienceBucket') = $${p}`); values.push(yoe); p++ }
      if (cvType) { conds.push(`s.cv_type = $${p}`); values.push(cvType); p++ }
      if (parseStatus) { conds.push(`s.cv_parse_status = $${p}`); values.push(parseStatus); p++ }
      if (from) { conds.push(`s.submitted_at >= $${p}`); values.push(new Date(from)); p++ }
      if (to) { conds.push(`s.submitted_at <= $${p}`); values.push(new Date(to)); p++ }

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
          COALESCE(s.cv_json, NULL) AS cv_json,
          COALESCE(s.knet_profile->>'decision_status','pending') AS decision_status,
          NULL::text AS decision_reason,
          NULL::timestamptz AS decision_date
        FROM public.students s
        ${whereSQL}
        ORDER BY s.submitted_at DESC NULLS LAST
        OFFSET $${p}
        LIMIT $${p+1}
      `
      const result = await sql.query(q, [...values, offset, limit])
      const took = Date.now() - started
      console.warn('[ADMIN_QUERY_FALLBACK_STUDENTS]', JSON.stringify({ org_slug: orgSlug, took_ms: took, rows: result.rowCount, filters: { search, field, area, degree, yoe, cvType, parseStatus, from, to, offset, limit } }))
      return new Response(JSON.stringify({ students: result.rows }), { headers: { 'content-type': 'application/json' } })
    }

    // If we reach here, no data and no fallback
    const took = Date.now() - started
    console.log('[ADMIN_QUERY_EMPTY]', JSON.stringify({ org_slug: orgSlug, took_ms: took, filters: { search, field, area, degree, yoe, cvType, parseStatus, from, to, offset, limit } }))
    return new Response(JSON.stringify({ students: [] }), { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    console.error('Failed to fetch students:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch students' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}
