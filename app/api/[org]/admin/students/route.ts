import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org

  try {
    const result = await sql`
      SELECT 
        c.id::text AS id,
        c.full_name,
        c.email,
        c.phone,
        c.field_of_study,
        c.area_of_interest,
        CASE WHEN c.cv_type = 'ai_generated' THEN 'ai' ELSE 'uploaded' END AS cv_type,
        NULL::text AS cv_url, -- original blob public URL not stored; use PDF link instead
        CASE 
          WHEN c.suggested_vacancies IS NULL THEN NULL 
          ELSE array_to_string(ARRAY(SELECT jsonb_array_elements_text(c.suggested_vacancies)), '/')
        END AS suggested_vacancies,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(c.suggested_vacancies)), '{}') AS suggested_vacancies_list,
        c.created_at AS submitted_at,
        c.gpa,
        c.parse_status::text AS cv_parse_status,
        c.years_of_experience::text AS years_of_experience,
        jsonb_build_object(
          'degreeBucket', c.degree,
          'yearsOfExperienceBucket', c.years_of_experience::text,
          'areaOfInterest', c.area_of_interest
        ) AS knet_profile,
        c.cv_blob_key,
        c.cv_mime,
        c.cv_file_size,
        c.cv_json
      FROM candidates c
      JOIN organizations o ON o.id = c.org_id
      WHERE o.slug = ${orgSlug} AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `

    return NextResponse.json({ students: result.rows })
  } catch (error) {
    console.error('Failed to fetch students:', error)
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    )
  }
}
