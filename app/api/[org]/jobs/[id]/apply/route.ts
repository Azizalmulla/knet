import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/[org]/jobs/[id]/apply - Apply to a job
export async function POST(
  request: NextRequest,
  { params }: { params: { org: string; id: string } }
) {
  try {
    const { org: orgSlug, id: jobId } = params;
    const body = await request.json();
    const { candidate_email, cover_letter } = body;
    
    if (!candidate_email) {
      return NextResponse.json(
        { error: 'Candidate email is required' },
        { status: 400 }
      );
    }
    
    // Get org
    const orgRes = await sql`
      SELECT id::text as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const orgId = orgRes.rows[0].id;
    
    // Verify job exists and is open
    const jobRes = await sql`
      SELECT id::text, title, status
      FROM jobs
      WHERE id = ${jobId}::uuid
        AND org_id = ${orgId}::uuid
      LIMIT 1
    `;
    
    if (!jobRes.rows.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const job = jobRes.rows[0];
    
    if (job.status !== 'open') {
      return NextResponse.json(
        { error: 'This job is no longer accepting applications' },
        { status: 400 }
      );
    }
    
    // Find candidate by email
    const candidateRes = await sql`
      SELECT id::text, full_name
      FROM candidates
      WHERE email = ${candidate_email}
        AND org_id = ${orgId}::uuid
      LIMIT 1
    `;
    
    if (!candidateRes.rows.length) {
      return NextResponse.json(
        { error: 'Candidate not found. Please upload your CV first.' },
        { status: 404 }
      );
    }
    
    const candidate = candidateRes.rows[0];
    
    // Check if already applied
    const existingApp = await sql`
      SELECT id::text
      FROM job_applications
      WHERE job_id = ${jobId}::uuid
        AND candidate_id = ${candidate.id}::uuid
      LIMIT 1
    `;
    
    if (existingApp.rows.length > 0) {
      return NextResponse.json(
        { error: 'You have already applied to this job' },
        { status: 400 }
      );
    }
    
    // Create application
    const result = await sql`
      INSERT INTO job_applications (
        job_id,
        candidate_id,
        org_id,
        cover_letter,
        status
      )
      VALUES (
        ${jobId}::uuid,
        ${candidate.id}::uuid,
        ${orgId}::uuid,
        ${cover_letter || null},
        'applied'
      )
      RETURNING 
        id::text,
        applied_at,
        status
    `;
    
    return NextResponse.json({
      success: true,
      application: result.rows[0],
      message: `Successfully applied to ${job.title}`
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('[JOB_APPLY] Error:', error.message);
    
    // Handle duplicate application (shouldn't happen due to UNIQUE constraint check above)
    if (error.message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'You have already applied to this job' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to submit application' },
      { status: 500 }
    );
  }
}

// GET /api/[org]/jobs/[id]/apply - Check if candidate has applied
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string; id: string } }
) {
  try {
    const { org: orgSlug, id: jobId } = params;
    const { searchParams } = new URL(request.url);
    const candidateEmail = searchParams.get('email');
    
    if (!candidateEmail) {
      return NextResponse.json(
        { error: 'Email parameter required' },
        { status: 400 }
      );
    }
    
    // Get org
    const orgRes = await sql`
      SELECT id::text as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const orgId = orgRes.rows[0].id;
    
    // Check application status
    const result = await sql`
      SELECT 
        ja.id::text,
        ja.status,
        ja.applied_at
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      WHERE ja.job_id = ${jobId}::uuid
        AND c.email = ${candidateEmail}
        AND ja.org_id = ${orgId}::uuid
      LIMIT 1
    `;
    
    if (!result.rows.length) {
      return NextResponse.json({ applied: false });
    }
    
    return NextResponse.json({
      applied: true,
      application: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('[JOB_APPLY_CHECK] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to check application status' },
      { status: 500 }
    );
  }
}
