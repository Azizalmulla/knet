import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST: Invite candidates to interview
export async function POST(
  req: NextRequest,
  { params }: { params: { org: string; templateId: string } }
) {
  try {
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const orgId = orgResult.rows[0].id
    const body = await req.json()

    const { candidate_ids, expires_in_days } = body

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return NextResponse.json({ error: 'Candidate IDs are required' }, { status: 400 })
    }

    const expiryDays = expires_in_days || 7
    const createdSessions = []

    for (const candidateId of candidate_ids) {
      // Check if session already exists
      const existingResult = await sql`
        SELECT id FROM interview_sessions
        WHERE template_id = ${params.templateId}
          AND candidate_id = ${candidateId}
          AND status != 'expired'
      `

      if (existingResult.rows.length > 0) {
        continue // Skip if already invited
      }

      // Create session
      const sessionResult = await sql`
        INSERT INTO interview_sessions (
          org_id,
          template_id,
          candidate_id,
          status,
          expires_at
        )
        VALUES (
          ${orgId},
          ${params.templateId},
          ${candidateId},
          'pending',
          NOW() + INTERVAL '${expiryDays} days'
        )
        RETURNING id
      `

      createdSessions.push({
        session_id: sessionResult.rows[0].id,
        candidate_id: candidateId
      })
    }

    return NextResponse.json({
      success: true,
      invited_count: createdSessions.length,
      sessions: createdSessions
    })
  } catch (error) {
    console.error('[INTERVIEW_INVITE] Error:', error)
    return NextResponse.json({ error: 'Failed to invite candidates' }, { status: 500 })
  }
}
