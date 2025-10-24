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
    const { payload} = await jwtVerify(token, secret);
    
    const adminEmail = String((payload as any)?.email || '');
    const tokenOrgSlug = String((payload as any)?.orgSlug || '');
    
    return tokenOrgSlug === orgSlug ? adminEmail : null;
  } catch {
    return null;
  }
}

// GET /api/[org]/jobs/[id]/applicants - Get all applicants for a job
export async function GET(
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
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    
    // Get org
    const orgRes = await sql`
      SELECT id::text as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const orgId = orgRes.rows[0].id;
    
    // Get applicants
    const applicants = await sql`
      SELECT 
        ja.id::text as application_id,
        ja.status as application_status,
        ja.applied_at,
        ja.cover_letter,
        ja.reviewed_at,
        ja.reviewed_by,
        ja.notes,
        c.id::text as candidate_id,
        c.full_name,
        c.email,
        c.phone,
        c.field_of_study,
        c.university,
        c.gpa,
        c.years_of_experience,
        c.linkedin_url,
        c.github_url,
        c.portfolio_url,
        c.created_at as candidate_registered_at
      FROM job_applications ja
      JOIN candidates c ON c.id = ja.candidate_id
      WHERE ja.job_id = ${jobId}::uuid
        AND ja.org_id = ${orgId}::uuid
        AND (${status === 'all'} OR ja.status = ${status})
      ORDER BY ja.applied_at DESC
    `;
    
    return NextResponse.json({
      applicants: applicants.rows,
      total: applicants.rows.length
    });
    
  } catch (error: any) {
    console.error('[JOB_APPLICANTS] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch applicants' },
      { status: 500 }
    );
  }
}
