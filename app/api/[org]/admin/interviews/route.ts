import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    // Verify admin authentication via JWT cookie
    const token = req.cookies.get('admin_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
    )
    
    let decoded: any
    try {
      const { payload } = await jwtVerify(token, secret)
      decoded = payload
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (decoded.orgSlug !== params.org) {
      return NextResponse.json({ error: 'Unauthorized for this organization' }, { status: 403 })
    }

    // Get organization
    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const orgId = orgResult.rows[0].id

    // Get all interview sessions with candidate info and analysis
    const result = await sql`
      SELECT 
        s.id as session_id,
        s.status,
        s.started_at,
        s.completed_at,
        s.created_at,
        t.id as template_id,
        t.title as template_title,
        c.id as candidate_id,
        c.full_name as candidate_name,
        c.email as candidate_email,
        c.phone as candidate_phone,
        (
          SELECT COUNT(*) 
          FROM interview_responses r 
          WHERE r.session_id = s.id
        ) as responses_count,
        (
          SELECT COUNT(*) 
          FROM interview_questions q 
          WHERE q.template_id = s.template_id
        ) as total_questions,
        (
          SELECT AVG(a.overall_score)::INTEGER
          FROM interview_analysis a
          JOIN interview_responses r ON r.id = a.response_id
          WHERE r.session_id = s.id
        ) as avg_score
      FROM interview_sessions s
      JOIN interview_templates t ON t.id = s.template_id
      JOIN candidates c ON c.id = s.candidate_id
      WHERE s.org_id = ${orgId}
      ORDER BY s.created_at DESC
    `

    return NextResponse.json({
      success: true,
      interviews: result.rows
    })
  } catch (error) {
    console.error('[ADMIN_INTERVIEWS_LIST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interviews' },
      { status: 500 }
    )
  }
}
