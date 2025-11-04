import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export const runtime = 'nodejs';

// Mark interview session as completed
export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionId = params.sessionId;

    await sql`
      UPDATE interview_sessions
      SET status = 'completed', completed_at = now()
      WHERE id = ${sessionId}::uuid
        AND status = 'in_progress'
    `;

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[INTERVIEW_COMPLETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete session' },
      { status: 500 }
    );
  }
}
