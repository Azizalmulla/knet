import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { findRowForAudit } from '@/lib/career-map';
import { KnetProfileSchema, normalizeArea, normalizeDegree, normalizeYoE } from '@/lib/watheefti-taxonomy';
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

    // Resolve GPA to persist (number or null)
    let gpaToPersist: number | null = null;
    if (typeof data.gpa === 'number' && isFinite(data.gpa)) {
      gpaToPersist = Math.max(0, Math.min(4, Number(data.gpa)));
    } else if (Array.isArray(data.education) && data.education.length > 0) {
      // pick most recent education entry with a numeric GPA
      const sorted = [...data.education].sort((a: any, b: any) => {
        const ad = new Date(a.graduationDate || a.endDate || a.startDate || 0).getTime();
        const bd = new Date(b.graduationDate || b.endDate || b.startDate || 0).getTime();
        return bd - ad;
      });
      const withGpa = sorted.find((e: any) => e && e.gpa != null && !isNaN(parseFloat(String(e.gpa))));
      if (withGpa) {
        const val = parseFloat(String(withGpa.gpa));
        if (isFinite(val)) gpaToPersist = Math.max(0, Math.min(4, val));
      }
    }

    // Ensure required columns exist (idempotent for older schemas)
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_parse_status VARCHAR(20) DEFAULT 'queued'`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS years_of_experience TEXT`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS gpa NUMERIC(3,2)`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS suggested_vacancies_list TEXT[]`; } catch {}
    try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS knet_profile JSONB`; } catch {}

    // Insert into database with upsert and fallback for older schemas
    let result;
    // Prepare Postgres array literal for suggested_vacancies_list (text[])
    const sv = data.suggestedVacancies as string | null | undefined;
    const svList = sv ? sv.split('/').map((s: string) => s.trim()).filter(Boolean) : null;
    const svArrayLiteral = svList && svList.length
      ? `{${svList.map((v: string) => '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"').join(',')}}`
      : null;

    // Build normalized knet_profile
    const rawKP = (data as any)?.knetProfile
    const kp = (() => {
      try {
        if (rawKP) return KnetProfileSchema.parse(rawKP)
      } catch {}
      const degreeBucket = normalizeDegree((data as any)?.fieldOfStudy)
      const yearsOfExperienceBucket = normalizeYoE((data as any)?.yearsOfExperience)
      const areaOfInterest = normalizeArea((data as any)?.areaOfInterest)
      return { degreeBucket, yearsOfExperienceBucket, areaOfInterest }
    })()

    try {
      // Primary path: includes GPA and suggested_vacancies_list
      result = await sql`
        INSERT INTO students (
          full_name, 
          email, 
          phone, 
          field_of_study, 
          area_of_interest, 
          cv_type, 
          cv_url,
          gpa,
          years_of_experience,
          suggested_vacancies,
          suggested_vacancies_list,
          knet_profile
        ) VALUES (
          ${data.fullName},
          ${data.email},
          ${data.phone || null},
          ${data.fieldOfStudy || null},
          ${data.areaOfInterest || null},
          ${data.cvType || 'uploaded'},
          ${data.cvUrl || null},
          ${gpaToPersist},
          ${typeof data.yearsOfExperience === 'string' ? data.yearsOfExperience : null},
          ${sv || null},
          ${svArrayLiteral},
          ${JSON.stringify(kp)}
        )
        ON CONFLICT (email) DO UPDATE SET
          phone = EXCLUDED.phone,
          field_of_study = EXCLUDED.field_of_study,
          area_of_interest = EXCLUDED.area_of_interest,
          cv_type = EXCLUDED.cv_type,
          cv_url = EXCLUDED.cv_url,
          gpa = EXCLUDED.gpa,
          years_of_experience = EXCLUDED.years_of_experience,
          suggested_vacancies = EXCLUDED.suggested_vacancies,
          suggested_vacancies_list = EXCLUDED.suggested_vacancies_list,
          knet_profile = EXCLUDED.knet_profile
        RETURNING id
      `;
    } catch (primaryErr: any) {
      // Fallback for schemas missing GPA or suggested_vacancies_list
      if (primaryErr.message?.includes('relation "students" does not exist')) {
        return NextResponse.json(
          { error: 'Database table not configured. Please contact administrator.' },
          { status: 503 }
        );
      }

      result = await sql`
        INSERT INTO students (
          full_name, 
          email, 
          phone, 
          field_of_study, 
          area_of_interest, 
          cv_type, 
          cv_url
        ) VALUES (
          ${data.fullName},
          ${data.email},
          ${data.phone || null},
          ${data.fieldOfStudy || null},
          ${data.areaOfInterest || null},
          ${data.cvType || 'uploaded'},
          ${data.cvUrl || null}
        )
        ON CONFLICT (email) DO UPDATE SET
          phone = EXCLUDED.phone,
          field_of_study = EXCLUDED.field_of_study,
          area_of_interest = EXCLUDED.area_of_interest,
          cv_type = EXCLUDED.cv_type,
          cv_url = EXCLUDED.cv_url
        RETURNING id
      `;
    }

    const studentId = result.rows[0].id as number;

    // Mark parse queued and fire-and-forget parse via Document AI for non-AI, non-HTML files
    const shouldParse = (data?.cvType !== 'ai') && ((data?.mime || '').toLowerCase() !== 'text/html');
    if (shouldParse && data.cvUrl) {
      try { await sql`UPDATE students SET cv_parse_status = 'queued' WHERE id = ${studentId}`; } catch {}
      try {
        const bgUrl = new URL('/api/cv/parse', request.url);
        fetch(bgUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId, blobUrl: data.cvUrl || null, mime: data.mime || null }),
        }).catch(() => {});
      } catch {}
    } else {
      // If we skip parsing (AI HTML), set status to done so Admin doesn't show stuck queued
      try { await sql`UPDATE students SET cv_parse_status = 'done' WHERE id = ${studentId}`; } catch {}
    }

    return NextResponse.json({ 
      success: true, 
      id: studentId 
    });
  } catch (error: any) {
    // Detailed error logging for debugging
    console.error('SUBMIT_ERROR', {
      message: error?.message, 
      code: error?.code, 
      detail: error?.detail, 
      stack: error?.stack
    });
    
    return NextResponse.json(
      { error: error.message || 'Failed to submit data' },
      { status: 500 }
    );
  }
}
