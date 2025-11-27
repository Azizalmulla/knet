import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { createServerClient } from '@/lib/supabase-server';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/candidate/messages/[threadId]
 * Get all messages in a thread
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidateEmail = user.email.toLowerCase();
    const threadId = params.threadId;

    // Verify candidate owns this thread
    const threadRes = await sql`
      SELECT 
        t.id,
        t.subject,
        t.candidate_name,
        t.candidate_email,
        t.organization_id,
        o.name as org_name,
        o.slug as org_slug
      FROM inbox_threads t
      JOIN organizations o ON t.organization_id = o.id
      WHERE t.id = ${threadId}::uuid
      AND LOWER(t.candidate_email) = ${candidateEmail}
    `;

    if (threadRes.rows.length === 0) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const thread = threadRes.rows[0];

    // Get all messages in the thread
    const messagesRes = await sql`
      SELECT 
        id,
        sender_type,
        sender_name,
        sender_email,
        content,
        created_at
      FROM inbox_messages
      WHERE thread_id = ${threadId}::uuid
      ORDER BY created_at ASC
    `;

    // Mark messages as read (from candidate's perspective)
    // We could add a candidate_read_at column, but for now just return the messages

    return NextResponse.json({
      thread,
      messages: messagesRes.rows
    });

  } catch (error: any) {
    console.error('[Candidate Thread API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to load thread', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/candidate/messages/[threadId]
 * Send a reply in the thread
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { threadId: string } }
) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const candidateEmail = user.email.toLowerCase();
    const threadId = params.threadId;
    const { content } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // Verify candidate owns this thread and get org info
    const threadRes = await sql`
      SELECT 
        t.id,
        t.subject,
        t.candidate_name,
        t.candidate_email,
        t.organization_id,
        o.name as org_name,
        o.slug as org_slug
      FROM inbox_threads t
      JOIN organizations o ON t.organization_id = o.id
      WHERE t.id = ${threadId}::uuid
      AND LOWER(t.candidate_email) = ${candidateEmail}
    `;

    if (threadRes.rows.length === 0) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const thread = threadRes.rows[0];

    // Get candidate's name from their profile
    const candidateRes = await sql`
      SELECT full_name FROM candidates 
      WHERE LOWER(email) = ${candidateEmail}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const candidateName = candidateRes.rows[0]?.full_name || candidateEmail;

    // Insert the message
    const insertRes = await sql`
      INSERT INTO inbox_messages (
        thread_id,
        sender_type,
        sender_name,
        sender_email,
        content,
        created_at
      ) VALUES (
        ${threadId}::uuid,
        'candidate',
        ${candidateName},
        ${candidateEmail},
        ${content.trim()},
        NOW()
      )
      RETURNING id, created_at
    `;

    // Update thread's last_message_at and increment unread for admin
    await sql`
      UPDATE inbox_threads
      SET 
        last_message_at = NOW(),
        unread_count = unread_count + 1
      WHERE id = ${threadId}::uuid
    `;

    // Optionally send email notification to admin
    // (fire and forget)
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      // Get admin email for this org
      const adminRes = await sql`
        SELECT email FROM admin_users 
        WHERE organization_id = ${thread.organization_id}::uuid
        LIMIT 1
      `;
      
      if (adminRes.rows.length > 0) {
        const adminEmail = adminRes.rows[0].email;
        await resend.emails.send({
          from: process.env.RESEND_FROM || 'Wathefni <noreply@wathefni.ai>',
          to: adminEmail,
          subject: `New reply from ${candidateName}: ${thread.subject}`,
          html: `
            <h2>New message from ${candidateName}</h2>
            <p><strong>Subject:</strong> ${thread.subject}</p>
            <p><strong>From:</strong> ${candidateName} (${candidateEmail})</p>
            <hr>
            <p>${content.trim().replace(/\n/g, '<br>')}</p>
            <hr>
            <p><a href="https://wathefni.ai/${thread.org_slug}/admin/inbox">View in Inbox</a></p>
          `
        });
      }
    } catch (emailErr) {
      console.error('[Candidate Reply] Email notification failed:', emailErr);
    }

    return NextResponse.json({
      success: true,
      message: {
        id: insertRes.rows[0].id,
        created_at: insertRes.rows[0].created_at,
        sender_type: 'candidate',
        sender_name: candidateName,
        content: content.trim()
      }
    });

  } catch (error: any) {
    console.error('[Candidate Reply API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send reply', details: error.message },
      { status: 500 }
    );
  }
}
