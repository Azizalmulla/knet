import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Get authenticated student
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const studentEmail = user.email

    // Find candidate records for this student (across all orgs)
    const candidateResult = await sql`
      SELECT id, org_id, full_name, email
      FROM candidates
      WHERE email = ${studentEmail}
    `

    if (candidateResult.rows.length === 0) {
      return NextResponse.json({ success: true, interviews: [] })
    }

    // Get all interview sessions for these candidates
    const candidateIds = candidateResult.rows.map(c => c.id)
    
    // Try to fetch interviews - table might not exist
    try {
      // Build WHERE clause manually to handle array
      const whereConditions = candidateIds.map((_, i) => `s.candidate_id = $${i + 1}`).join(' OR ')
      
      const result = await sql.query(`
        SELECT 
          s.id as session_id,
          s.status,
          s.started_at,
          s.completed_at,
          s.expires_at,
          s.created_at,
          t.id as template_id,
          t.title as template_title,
          t.description as template_description,
          o.name as org_name,
          o.slug as org_slug,
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
        JOIN organizations o ON o.id = s.org_id
        WHERE ${candidateIds.length > 0 ? whereConditions : '1=0'}
        ORDER BY 
          CASE s.status 
            WHEN 'pending' THEN 1 
            WHEN 'in_progress' THEN 2 
            WHEN 'completed' THEN 3 
            WHEN 'expired' THEN 4 
          END,
          s.created_at DESC
      `, candidateIds)

      return NextResponse.json({
        success: true,
        interviews: result.rows
      })
    } catch (tableError: any) {
      // Table doesn't exist yet - return empty array
      console.log('[STUDENT_INTERVIEWS] Tables may not exist yet:', tableError.message)
      return NextResponse.json({ success: true, interviews: [] })
    }
  } catch (error) {
    console.error('[STUDENT_INTERVIEWS] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch interviews' },
      { status: 500 }
    )
  }
}
