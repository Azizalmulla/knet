import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

// Get interview session details for candidate
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    const result = await sql`
      SELECT 
        s.id,
        s.status,
        s.expires_at,
        c.full_name as candidate_name,
        c.email as candidate_email,
        t.title as interview_title,
        json_agg(
          json_build_object(
            'id', q.id,
            'question_text', q.question_text,
            'time_limit_seconds', q.time_limit_seconds,
            'order_index', q.order_index,
            'has_response', CASE WHEN r.id IS NOT NULL THEN true ELSE false END
          ) ORDER BY q.order_index
        ) as questions
      FROM interview_sessions s
      JOIN candidates c ON c.id = s.candidate_id
      JOIN interview_templates t ON t.id = s.template_id
      LEFT JOIN interview_questions q ON q.template_id = s.template_id
      LEFT JOIN interview_responses r ON r.session_id = s.id AND r.question_id = q.id
      WHERE s.id = ${sessionId}::uuid
        AND s.expires_at > now()
      GROUP BY s.id, c.full_name, c.email, t.title, s.status, s.expires_at
    `;

    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Session not found or expired' },
        { status: 404 }
      );
    }

    const session = result.rows[0];

    // Update status to in_progress if first access
    if (session.status === 'pending') {
      await sql`
        UPDATE interview_sessions
        SET status = 'in_progress', started_at = now()
        WHERE id = ${sessionId}::uuid
      `;
      session.status = 'in_progress';
    }

    return NextResponse.json(session);

  } catch (error) {
    console.error('[INTERVIEW_SESSION] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
