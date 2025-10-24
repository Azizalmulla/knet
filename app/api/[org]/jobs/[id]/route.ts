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

// GET /api/[org]/jobs/[id] - Get job details
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string; id: string } }
) {
  try {
    const { org: orgSlug, id: jobId } = params;
    
    // Get org
    const orgRes = await sql`
      SELECT id::text as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const orgId = orgRes.rows[0].id;
    
    // Get job
    const jobRes = await sql`
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
        j.created_by,
        o.name as company_name
      FROM jobs j
      JOIN organizations o ON o.id = j.org_id
      WHERE j.id = ${jobId}::uuid
        AND j.org_id = ${orgId}::uuid
      LIMIT 1
    `;
    
    if (!jobRes.rows.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    return NextResponse.json({ job: jobRes.rows[0] });
    
  } catch (error: any) {
    console.error('[JOB_GET] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    );
  }
}

// PATCH /api/[org]/jobs/[id] - Update job
export async function PATCH(
  request: NextRequest,
  { params }: { params: { org: string; id: string } }
) {
  try {
    const { org: orgSlug, id: jobId } = params;
    
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
    
    const body = await request.json();
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    // Build dynamic UPDATE query
    const allowedFields = [
      'title', 'department', 'location', 'job_type', 'work_mode',
      'salary_min', 'salary_max', 'salary_currency',
      'description', 'requirements', 'responsibilities', 'benefits',
      'skills', 'status'
    ];
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'skills') {
          // Format skills array for PostgreSQL
          const skillsArray = body[field] && body[field].length > 0 
            ? `{${body[field].map((s: string) => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`
            : null;
          updates.push(`${field} = $${paramIndex}`);
          values.push(skillsArray);
        } else {
          updates.push(`${field} = $${paramIndex}`);
          values.push(body[field]);
        }
        paramIndex++;
      }
    }
    
    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }
    
    updates.push(`updated_at = now()`);
    
    const updateQuery = `
      UPDATE jobs
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}::uuid
        AND org_id = $${paramIndex + 1}::uuid
      RETURNING id::text, title, status, updated_at
    `;
    
    values.push(jobId, orgId);
    
    const result = await sql.query(updateQuery, values);
    
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      job: result.rows[0]
    });
    
  } catch (error: any) {
    console.error('[JOB_PATCH] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    );
  }
}

// DELETE /api/[org]/jobs/[id] - Delete job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { org: string; id: string } }
) {
  try {
    const { org: orgSlug, id: jobId } = params;
    
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
    
    // Delete job (CASCADE will handle applications, views, saved)
    const result = await sql`
      DELETE FROM jobs
      WHERE id = ${jobId}::uuid
        AND org_id = ${orgId}::uuid
      RETURNING id::text
    `;
    
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error('[JOB_DELETE] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}
