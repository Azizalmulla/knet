import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/candidate/cv
 * Get candidate's CV data
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidateEmail = user.email.toLowerCase();

    // Get latest CV
    const cvRes = await sql`
      SELECT 
        c.id,
        c.full_name,
        c.email,
        c.phone,
        c.cv_json,
        c.cv_blob_key,
        c.field_of_study,
        c.area_of_interest,
        c.years_of_experience,
        c.degree,
        c.gpa,
        c.cv_type,
        c.parse_status,
        c.created_at,
        c.updated_at,
        o.name as org_name,
        o.slug as org_slug
      FROM candidates c
      LEFT JOIN organizations o ON c.org_id = o.id
      WHERE LOWER(c.email) = ${candidateEmail}
      AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 1
    `;

    if (cvRes.rows.length === 0) {
      return NextResponse.json({ 
        cv: null,
        message: 'No CV found. Upload or create one to get started.'
      });
    }

    const cv = cvRes.rows[0];

    // Parse CV JSON
    let cvData = {};
    try {
      if (typeof cv.cv_json === 'string') {
        cvData = JSON.parse(cv.cv_json);
      } else if (cv.cv_json) {
        cvData = cv.cv_json;
      }
    } catch (e) {
      console.error('Failed to parse CV JSON:', e);
    }

    return NextResponse.json({
      cv: {
        id: cv.id,
        fullName: cv.full_name,
        email: cv.email,
        phone: cv.phone,
        fieldOfStudy: cv.field_of_study,
        areaOfInterest: cv.area_of_interest,
        yearsOfExperience: cv.years_of_experience,
        degree: cv.degree,
        gpa: cv.gpa,
        cvType: cv.cv_type,
        parseStatus: cv.parse_status,
        cvBlobKey: cv.cv_blob_key,
        createdAt: cv.created_at,
        updatedAt: cv.updated_at,
        orgName: cv.org_name,
        orgSlug: cv.org_slug,
        // Parsed CV data
        ...cvData
      }
    });

  } catch (error: any) {
    console.error('[Candidate CV API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load CV', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/candidate/cv
 * Update candidate's CV data
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidateEmail = user.email.toLowerCase();
    const updates = await request.json();

    // Get current CV
    const currentRes = await sql`
      SELECT id, cv_json FROM candidates
      WHERE LOWER(email) = ${candidateEmail}
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (currentRes.rows.length === 0) {
      return NextResponse.json({ error: 'No CV found' }, { status: 404 });
    }

    const candidateId = currentRes.rows[0].id;
    let currentCvJson = {};
    try {
      if (typeof currentRes.rows[0].cv_json === 'string') {
        currentCvJson = JSON.parse(currentRes.rows[0].cv_json);
      } else if (currentRes.rows[0].cv_json) {
        currentCvJson = currentRes.rows[0].cv_json;
      }
    } catch (e) {}

    // Merge updates with current CV JSON
    const updatedCvJson = {
      ...currentCvJson,
      fullName: updates.fullName,
      email: updates.email,
      phone: updates.phone,
      location: updates.location,
      summary: updates.summary,
      education: updates.education,
      experience: updates.experience,
      skills: updates.skills,
      projects: updates.projects,
    };

    // Update the candidate record
    await sql`
      UPDATE candidates
      SET 
        full_name = ${updates.fullName || null},
        phone = ${updates.phone || null},
        cv_json = ${JSON.stringify(updatedCvJson)}::jsonb,
        updated_at = NOW()
      WHERE id = ${candidateId}::uuid
    `;

    return NextResponse.json({
      success: true,
      message: 'CV updated successfully'
    });

  } catch (error: any) {
    console.error('[Candidate CV Update] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update CV', details: error.message },
      { status: 500 }
    );
  }
}
