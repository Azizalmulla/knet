/**
 * Inbox Thread API - Get thread details with messages
 * GET /api/[org]/admin/inbox/[threadId]
 * POST /api/[org]/admin/inbox/[threadId] - Send reply
 * PATCH /api/[org]/admin/inbox/[threadId] - Mark as read/archived
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: { org: string; threadId: string } }
) {
  const { org: orgSlug, threadId } = params;

  try {
    // Get organization
    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${orgSlug}
    `;

    const org = orgResult.rows[0];
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get thread
    const threadResult = await sql`
      SELECT 
        t.id,
        t.subject,
        t.candidate_name,
        t.candidate_email,
        t.candidate_id,
        t.is_archived,
        t.unread_count,
        t.created_at
      FROM inbox_threads t
      WHERE t.id = ${threadId} AND t.organization_id = ${org.id}
    `;

    const thread = threadResult.rows[0];
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Get messages
    const messagesResult = await sql`
      SELECT 
        id,
        from_type,
        from_name,
        from_email,
        content,
        is_read,
        created_at
      FROM inbox_messages
      WHERE thread_id = ${threadId}
      ORDER BY created_at ASC
    `;

    return NextResponse.json({
      thread,
      messages: messagesResult.rows,
    });
  } catch (error) {
    console.error('Failed to fetch thread:', error);
    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}

// Send reply
export async function POST(
  req: NextRequest,
  { params }: { params: { org: string; threadId: string } }
) {
  const { org: orgSlug, threadId } = params;

  try {
    const body = await req.json();
    const { content, adminEmail, adminName } = body;

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    // Get organization
    const orgResult = await sql`
      SELECT id, name, slug FROM organizations WHERE slug = ${orgSlug}
    `;

    const org = orgResult.rows[0];
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Get thread to verify it belongs to this org
    const threadResult = await sql`
      SELECT 
        id,
        candidate_email,
        subject
      FROM inbox_threads
      WHERE id = ${threadId} AND organization_id = ${org.id}
    `;

    const thread = threadResult.rows[0];
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Insert reply message
    const messageResult = await sql`
      INSERT INTO inbox_messages (
        thread_id,
        from_type,
        from_name,
        from_email,
        content,
        is_read
      ) VALUES (
        ${threadId},
        'admin',
        ${adminName || org.name},
        ${adminEmail || `${org.slug}@wathefni.ai`},
        ${content},
        TRUE
      )
      RETURNING *
    `;

    const message = messageResult.rows[0];

    // Send actual email to candidate via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        const fromEmail = `${org.slug}@wathefni.ai`;
        const fromName = `${org.name} HR Team`;

        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: thread.candidate_email,
          subject: `Re: ${thread.subject}`,
          text: content,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
              ${content.split('\n').map((line: string) => 
                line.trim() === '' ? '<br>' : `<p style="margin: 12px 0;">${line}</p>`
              ).join('')}
            </div>
          `,
        });

        console.log('✅ Reply sent to candidate:', thread.candidate_email);
      } catch (emailError) {
        console.error('Failed to send reply email:', emailError);
        // Don't fail the whole request if email fails
      }
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error) {
    console.error('Failed to send reply:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

// Mark as read/archived
export async function PATCH(
  req: NextRequest,
  { params }: { params: { org: string; threadId: string } }
) {
  const { org: orgSlug, threadId } = params;

  try {
    const body = await req.json();
    const { action } = body; // 'mark_read' | 'archive' | 'unarchive'

    // Get organization
    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${orgSlug}
    `;

    const org = orgResult.rows[0];
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (action === 'mark_read') {
      // Mark all unread messages in thread as read
      await sql`
        UPDATE inbox_messages
        SET is_read = TRUE, read_at = NOW()
        WHERE thread_id = ${threadId} 
          AND is_read = FALSE
          AND from_type = 'candidate'
      `;

      // Reset unread count
      await sql`
        UPDATE inbox_threads
        SET unread_count = 0
        WHERE id = ${threadId} AND organization_id = ${org.id}
      `;
    } else if (action === 'archive') {
      await sql`
        UPDATE inbox_threads
        SET is_archived = TRUE
        WHERE id = ${threadId} AND organization_id = ${org.id}
      `;
    } else if (action === 'unarchive') {
      await sql`
        UPDATE inbox_threads
        SET is_archived = FALSE
        WHERE id = ${threadId} AND organization_id = ${org.id}
      `;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update thread:', error);
    return NextResponse.json(
      { error: 'Failed to update thread' },
      { status: 500 }
    );
  }
}
