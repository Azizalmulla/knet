import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { findRowForAudit } from '@/lib/career-map';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Audit logging
    if (data.fieldOfStudy && data.areaOfInterest) {
      const auditRow = findRowForAudit(data.fieldOfStudy, data.areaOfInterest);
      const rawHash = data.suggestedVacancies ? crypto.createHash('sha256').update(data.suggestedVacancies).digest('hex') : null;
      console.log('CV_SUBMIT_AUDIT:', {
        timestamp: new Date().toISOString(),
        field: data.fieldOfStudy,
        area: data.areaOfInterest,
        rawRow: auditRow,
        suggestedVacanciesHash: rawHash,
        userEmail: data.email
      });
    }

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
        suggested_vacancies,
        suggested_vacancies_list
      ) VALUES (
        ${data.fullName},
        ${data.email},
        ${data.phone},
        ${data.fieldOfStudy},
        ${data.areaOfInterest},
        ${data.cvType || 'uploaded'},
        ${data.cvUrl},
        ${data.suggestedVacancies || null},
        ${data.suggestedVacancies ? JSON.stringify(data.suggestedVacancies.split('/')) : null}
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
