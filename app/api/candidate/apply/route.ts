import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/candidate/apply
 * Apply to a job with one click (uses existing CV)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidateEmail = user.email.toLowerCase();
    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    // Get job details
    const jobRes = await sql`
      SELECT 
        j.id,
        j.title,
        j.org_id,
        o.name as org_name,
        o.slug as org_slug
      FROM jobs j
      JOIN organizations o ON j.org_id = o.id
      WHERE j.id = ${jobId}::uuid
      AND j.status = 'open'
    `;

    if (jobRes.rows.length === 0) {
      return NextResponse.json({ error: 'Job not found or closed' }, { status: 404 });
    }

    const job = jobRes.rows[0];

    // Check if already applied to this org
    const existingRes = await sql`
      SELECT id FROM candidates
      WHERE LOWER(email) = ${candidateEmail}
      AND org_id = ${job.org_id}::uuid
      AND deleted_at IS NULL
      LIMIT 1
    `;

    if (existingRes.rows.length > 0) {
      return NextResponse.json({ 
        success: true,
        alreadyApplied: true,
        message: `You've already applied to ${job.org_name}`
      });
    }

    // Get candidate's latest CV data
    const cvRes = await sql`
      SELECT 
        id,
        full_name,
        email,
        phone,
        cv_json,
        cv_blob_key,
        field_of_study,
        area_of_interest,
        years_of_experience,
        degree,
        knet_profile
      FROM candidates
      WHERE LOWER(email) = ${candidateEmail}
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (cvRes.rows.length === 0) {
      return NextResponse.json({ 
        error: 'No CV found. Please upload your CV first.',
        needsCV: true
      }, { status: 400 });
    }

    const existingCV = cvRes.rows[0];

    // Create application (new candidate entry for this org)
    const insertRes = await sql`
      INSERT INTO candidates (
        org_id,
        email,
        full_name,
        phone,
        cv_json,
        cv_blob_key,
        field_of_study,
        area_of_interest,
        years_of_experience,
        degree,
        knet_profile,
        cv_type,
        parse_status,
        source,
        created_at
      ) VALUES (
        ${job.org_id}::uuid,
        ${candidateEmail},
        ${existingCV.full_name},
        ${existingCV.phone},
        ${JSON.stringify(existingCV.cv_json || {})}::jsonb,
        ${existingCV.cv_blob_key},
        ${existingCV.field_of_study},
        ${existingCV.area_of_interest},
        ${existingCV.years_of_experience},
        ${existingCV.degree},
        ${JSON.stringify(existingCV.knet_profile || {})}::jsonb,
        'uploaded',
        'completed',
        'job_application',
        NOW()
      )
      RETURNING id
    `;

    // Log the application
    try {
      await sql`
        INSERT INTO job_applications (
          job_id,
          candidate_id,
          status,
          applied_at
        ) VALUES (
          ${jobId}::uuid,
          ${insertRes.rows[0].id}::uuid,
          'applied',
          NOW()
        )
      `;
    } catch (e) {
      // job_applications table might not exist - that's okay
      console.log('[Apply] job_applications table not available, skipping');
    }

    return NextResponse.json({
      success: true,
      message: `Successfully applied to ${job.title} at ${job.org_name}!`,
      applicationId: insertRes.rows[0].id
    });

  } catch (error: any) {
    console.error('[Candidate Apply API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to apply', details: error.message },
      { status: 500 }
    );
  }
}
