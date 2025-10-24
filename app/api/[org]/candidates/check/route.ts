import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/[org]/candidates/check?email=...
// Check if a candidate exists for this organization
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    const orgSlug = params.org;
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
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
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    const orgId = orgRes.rows[0].id;

    // Check if candidate exists
    const candidateRes = await sql`
      SELECT id::text
      FROM candidates
      WHERE email = ${email}
        AND org_id = ${orgId}::uuid
      LIMIT 1
    `;

    return NextResponse.json({
      exists: candidateRes.rows.length > 0,
      email: email
    });

  } catch (error: any) {
    console.error('[CANDIDATE_CHECK] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to check candidate' },
      { status: 500 }
    );
  }
}
