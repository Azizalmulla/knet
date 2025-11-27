import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/candidate/messages
 * Get all message threads for the logged-in candidate
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidateEmail = user.email.toLowerCase();

    // Get all threads where this candidate is involved
    const threadsRes = await sql`
      SELECT 
        t.id,
        t.subject,
        t.candidate_name,
        t.candidate_email,
        t.unread_count,
        t.last_message_at,
        t.is_archived,
        t.created_at,
        o.name as org_name,
        o.slug as org_slug,
        o.logo_url as org_logo,
        (
          SELECT COUNT(*) FROM inbox_messages m WHERE m.thread_id = t.id
        ) as message_count
      FROM inbox_threads t
      JOIN organizations o ON t.organization_id = o.id
      WHERE LOWER(t.candidate_email) = ${candidateEmail}
      AND t.is_archived = false
      ORDER BY t.last_message_at DESC NULLS LAST
      LIMIT 50
    `;

    return NextResponse.json({
      threads: threadsRes.rows,
      total: threadsRes.rows.length
    });

  } catch (error: any) {
    console.error('[Candidate Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load messages', details: error.message },
      { status: 500 }
    );
  }
}
