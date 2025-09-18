import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(request: Request) {
  // Check admin authorization via x-admin-key header with trimming
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  const allowed = [envKey, fallback].filter(Boolean);
  if (!provided || !allowed.includes(provided)) {
    return new Response('Unauthorized', { status: 401 });
  }
  try {
    // Ensure required columns exist (idempotent)
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS gpa NUMERIC(3,2)`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_parse_status TEXT DEFAULT 'queued'`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS years_of_experience TEXT`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS knet_profile JSONB`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_json JSONB`; } catch {}

    const result = await sql`
      SELECT 
        id,
        full_name,
        email,
        phone,
        field_of_study,
        area_of_interest,
        cv_type,
        cv_url,
        suggested_vacancies,
        suggested_vacancies_list,
        submitted_at,
        gpa,
        cv_parse_status,
        years_of_experience,
        knet_profile,
        cv_json
      FROM students 
      ORDER BY submitted_at DESC
    `;

    return NextResponse.json({ 
      students: result.rows 
    });
  } catch (error) {
    console.error('Failed to fetch students:', error);
    return NextResponse.json(
      { error: 'Failed to fetch students' },
      { status: 500 }
    );
  }
}
