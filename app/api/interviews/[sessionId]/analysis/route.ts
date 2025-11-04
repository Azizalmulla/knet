import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

// Get analysis results for an interview session
export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    // Get session details with all responses and analysis
    const result = await sql`
      SELECT 
        s.id as session_id,
        s.status,
        s.started_at,
        s.completed_at,
        c.id as candidate_id,
        c.full_name as candidate_name,
        c.email as candidate_email,
        t.title as interview_title,
        json_agg(
          json_build_object(
            'question_id', q.id,
            'question_text', q.question_text,
            'question_order', q.order_index,
            'video_url', r.video_blob_key,
            'duration', r.video_duration_seconds,
            'transcript', r.transcript,
            'recorded_at', r.recorded_at,
            'analysis', json_build_object(
              'overall_score', a.overall_score,
              'content_quality_score', a.content_quality_score,
              'communication_score', a.communication_score,
              'technical_score', a.technical_score,
              'ai_reasoning', a.ai_reasoning,
              'key_strengths', a.key_strengths,
              'key_concerns', a.key_concerns,
              'detected_language', a.detected_language,
              'sentiment', a.sentiment,
              'analyzed_at', a.analyzed_at
            )
          ) ORDER BY q.order_index
        ) as responses
      FROM interview_sessions s
      JOIN candidates c ON c.id = s.candidate_id
      JOIN interview_templates t ON t.id = s.template_id
      LEFT JOIN interview_responses r ON r.session_id = s.id
      LEFT JOIN interview_questions q ON q.id = r.question_id
      LEFT JOIN interview_analysis a ON a.response_id = r.id
      WHERE s.id = ${sessionId}::uuid
      GROUP BY s.id, c.id, c.full_name, c.email, t.title, s.status, s.started_at, s.completed_at
    `;

    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = result.rows[0];

    // Calculate average scores
    const responses = session.responses.filter((r: any) => r.analysis.overall_score !== null);
    const avgScore = responses.length > 0
      ? Math.round(responses.reduce((sum: number, r: any) => sum + (r.analysis.overall_score || 0), 0) / responses.length)
      : null;

    return NextResponse.json({
      session: {
        id: session.session_id,
        status: session.status,
        started_at: session.started_at,
        completed_at: session.completed_at,
        interview_title: session.interview_title,
        average_score: avgScore,
      },
      candidate: {
        id: session.candidate_id,
        name: session.candidate_name,
        email: session.candidate_email,
      },
      responses: session.responses,
    });

  } catch (error) {
    console.error('[INTERVIEW_ANALYSIS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
