import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Insert into database
    const result = await sql`
      INSERT INTO students (
        full_name, 
        email, 
        phone, 
        field_of_study, 
        area_of_interest, 
        cv_type, 
        cv_url,
        suggested_vacancies
      ) VALUES (
        ${data.fullName},
        ${data.email},
        ${data.phone},
        ${data.fieldOfStudy},
        ${data.areaOfInterest},
        ${data.cvType || 'uploaded'},
        ${data.cvUrl},
        ${data.suggestedVacancies || null}
      )
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id 
    });
  } catch (error) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit data' },
      { status: 500 }
    );
  }
}
