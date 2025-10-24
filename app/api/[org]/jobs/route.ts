import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { jwtVerify } from '@/lib/esm-compat/jose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Verify admin JWT
async function authorizeAdmin(request: NextRequest, orgSlug: string) {
  try {
    const token = request.cookies.get('admin_session')?.value || '';
    if (!token) return null;
    
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
    );
    const { payload } = await jwtVerify(token, secret);
    
    const adminEmail = String((payload as any)?.email || '');
    const tokenOrgSlug = String((payload as any)?.orgSlug || '');
    
    return tokenOrgSlug === orgSlug ? adminEmail : null;
  } catch {
    return null;
  }
}

// GET /api/[org]/jobs - List jobs
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'open';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Get org
    const orgRes = await sql`
      SELECT id::text as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const orgId = orgRes.rows[0].id;
    
    // Get jobs
    const jobs = await sql`
      SELECT 
        j.id::text,
        j.title,
        j.department,
        j.location,
        j.job_type,
        j.work_mode,
        j.salary_min,
        j.salary_max,
        j.salary_currency,
        j.description,
        j.requirements,
        j.responsibilities,
        j.benefits,
        j.skills,
        j.status,
        j.slug,
        j.view_count,
        j.application_count,
        j.created_at,
        j.updated_at,
        j.created_by
      FROM jobs j
      WHERE j.org_id = ${orgId}::uuid
        AND (${status === 'all'} OR j.status = ${status})
      ORDER BY j.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
    
    // Get total count
    const countRes = await sql`
      SELECT COUNT(*) as total
      FROM jobs
      WHERE org_id = ${orgId}::uuid
        AND (${status === 'all'} OR status = ${status})
    `;
    
    return NextResponse.json({
      jobs: jobs.rows,
      total: parseInt(countRes.rows[0].total),
      limit,
      offset
    });
    
  } catch (error: any) {
    console.error('[JOBS_GET] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}

// POST /api/[org]/jobs - Create job
export async function POST(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;
    
    // Verify admin
    const adminEmail = await authorizeAdmin(request, orgSlug);
    if (!adminEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get org
    const orgRes = await sql`
      SELECT id::text as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const orgId = orgRes.rows[0].id;
    
    // Parse request body
    const body = await request.json();
    const {
      title,
      department,
      location,
      job_type,
      work_mode,
      salary_min,
      salary_max,
      salary_currency = 'KWD',
      description,
      requirements,
      responsibilities,
      benefits,
      skills = [],
      status = 'open'
    } = body;
    
    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }
    
    // Create job
    // Format skills array for PostgreSQL
    const skillsArray = skills && skills.length > 0 
      ? `{${skills.map((s: string) => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`
      : null;
    
    const result = await sql`
      INSERT INTO jobs (
        org_id,
        title,
        department,
        location,
        job_type,
        work_mode,
        salary_min,
        salary_max,
        salary_currency,
        description,
        requirements,
        responsibilities,
        benefits,
        skills,
        status,
        created_by
      )
      VALUES (
        ${orgId}::uuid,
        ${title},
        ${department || null},
        ${location || null},
        ${job_type || null},
        ${work_mode || null},
        ${salary_min || null},
        ${salary_max || null},
        ${salary_currency},
        ${description},
        ${requirements || null},
        ${responsibilities || null},
        ${benefits || null},
        ${skillsArray},
        ${status},
        ${adminEmail}
      )
      RETURNING 
        id::text,
        title,
        slug,
        status,
        created_at
    `;
    
    return NextResponse.json({
      success: true,
      job: result.rows[0]
    }, { status: 201 });
    
  } catch (error: any) {
    console.error('[JOBS_POST] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
