import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { findRowForAudit } from '@/lib/career-map';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  try {
    const data = await request.json();

    // Validate required fields
    if (!data.fullName || !data.email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Audit logging (production-safe)
    if (data.fieldOfStudy && data.areaOfInterest) {
      const auditRow = findRowForAudit(data.fieldOfStudy, data.areaOfInterest);
      const rawHash = data.suggestedVacancies ? crypto.createHash('sha256').update(data.suggestedVacancies).digest('hex') : null;
      // Use production-safe logging
      if (process.env.NODE_ENV === 'development') {
        console.log('CV_SUBMIT_AUDIT:', {
          timestamp: new Date().toISOString(),
          field: data.fieldOfStudy,
          area: data.areaOfInterest,
          rawRow: auditRow,
          suggestedVacanciesHash: rawHash,
          userEmail: data.email
        });
      }
    }

    // Insert into database with better error handling
    let result;
    try {
      result = await sql`
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
          ${data.phone || null},
          ${data.fieldOfStudy || null},
          ${data.areaOfInterest || null},
          ${data.cvType || 'uploaded'},
          ${data.cvUrl || null},
          ${data.suggestedVacancies || null},
          ${data.suggestedVacancies ? JSON.stringify(data.suggestedVacancies.split('/')) : null}
        )
        RETURNING id
      `;
    } catch (dbError: any) {
      // Check if it's a missing table error
      if (dbError.message?.includes('relation "students" does not exist')) {
        return NextResponse.json(
          { error: 'Database table not configured. Please contact administrator.' },
          { status: 503 }
        );
      }
      throw dbError; // Re-throw other errors
    }

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id 
    });
  } catch (error: any) {
    // Log error details in development only
    if (process.env.NODE_ENV === 'development') {
      console.error('Submission error:', error);
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to submit data' },
      { status: 500 }
    );
  }
}
