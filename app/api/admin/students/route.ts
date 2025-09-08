import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
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
        submitted_at
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
