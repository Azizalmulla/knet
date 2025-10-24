/**
 * Webhook endpoint for receiving candidate email replies
 * Called by Resend when a candidate replies to an email
 * 
 * Resend will POST to: /api/inbox/webhook (NOT org-specific)
 * We extract the org from the recipient email (e.g., nbk@wathefni.ai)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { notifyAdminOfNewMessage, getOrgAdminEmail } from '@/lib/inbox-notifications';

export async function POST(req: NextRequest) {
  try {

    // Verify webhook signature (Resend webhook verification)
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    
    // TODO: Implement signature verification
    // For now, we'll just log it
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('⚠️ Webhook received without Svix headers');
    }

    const body = await req.json();

    // Resend webhook format
    const { type, data } = body;

    if (type !== 'email.received') {
      console.log('Ignoring webhook type:', type);
      return NextResponse.json({ received: true });
    }

    // Extract email data
    const {
      from, // { name: string, email: string }
      to, // Array of recipients: [{ email: string }]
      subject,
      text,
      html,
      headers,
    } = data;

    // Extract org slug from recipient email
    // e.g., "nbk@wathefni.ai" → "nbk"
    const recipientEmail = Array.isArray(to) ? to[0]?.email : to;
    if (!recipientEmail) {
      console.error('No recipient email in webhook data');
      return NextResponse.json({ error: 'No recipient' }, { status: 400 });
    }

    const match = recipientEmail.match(/^(.+)@wathefni\.ai$/);
    if (!match) {
      console.error('Invalid recipient format:', recipientEmail);
      return NextResponse.json({ error: 'Invalid recipient' }, { status: 400 });
    }

    const orgSlug = match[1];

    // Get organization
    const orgResult = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug}
    `;

    const org = orgResult.rows[0];
    if (!org) {
      console.error('Organization not found for slug:', orgSlug);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    console.log(`📧 Incoming email for org: ${orgSlug}`);

    // Check if this is a reply (look for In-Reply-To or References header)
    const inReplyTo = headers?.['in-reply-to'] || headers?.['references'];
    let threadId = null;

    // Try to find existing thread by candidate email and subject
    const candidateEmail = typeof from === 'string' ? from : from?.email;
    const candidateName = typeof from === 'object' ? from?.name : candidateEmail;

    if (inReplyTo) {
      // Try to find thread by message ID reference
      // This would require storing Message-ID when sending
      console.log('Reply detected with In-Reply-To:', inReplyTo);
    }

    // Find existing thread by candidate email
    const existingThreadResult = await sql`
      SELECT id 
      FROM inbox_threads 
      WHERE organization_id = ${org.id}
        AND candidate_email = ${candidateEmail}
        AND NOT is_archived
      ORDER BY last_message_at DESC
      LIMIT 1
    `;

    const existingThread = existingThreadResult.rows[0];
    if (existingThread) {
      threadId = existingThread.id;
    } else {
      // Create new thread
      const newThreadResult = await sql`
        INSERT INTO inbox_threads (
          organization_id,
          subject,
          candidate_name,
          candidate_email,
          unread_count
        ) VALUES (
          ${org.id},
          ${subject || 'No subject'},
          ${candidateName || candidateEmail},
          ${candidateEmail},
          1
        )
        RETURNING id
      `;
      const newThread = newThreadResult.rows[0];
      threadId = newThread.id;
    }

    // Insert message
    await sql`
      INSERT INTO inbox_messages (
        thread_id,
        from_type,
        from_name,
        from_email,
        content,
        is_read
      ) VALUES (
        ${threadId},
        'candidate',
        ${candidateName || candidateEmail},
        ${candidateEmail},
        ${text || html || ''},
        FALSE
      )
    `;

    console.log(`✅ Message saved to thread ${threadId}`);

    // Send notification to admin
    const adminEmail = await getOrgAdminEmail(org.id);
    if (adminEmail) {
      await notifyAdminOfNewMessage({
        adminEmail,
        candidateName: candidateName || candidateEmail,
        subject: subject || 'No subject',
        messagePreview: (text || html || '').substring(0, 300),
        orgSlug,
        threadId,
      });
    }

    return NextResponse.json({ success: true, threadId, orgSlug });
  } catch (error) {
    console.error('❌ Inbox webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}
