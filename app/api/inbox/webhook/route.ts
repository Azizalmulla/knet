/**
 * Global Inbox Webhook - Resend will POST here for incoming replies
 * Path: /api/inbox/webhook
 * We extract the org from the recipient email (e.g., nbk@wathefni.ai)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { notifyAdminOfNewMessage, getOrgAdminEmail } from '@/lib/inbox-notifications';

export async function POST(req: NextRequest) {
  try {
    // Optional: verify Svix headers (Resend)
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('[INBOX] Webhook without Svix headers');
    }

    const body = await req.json();
    const { type, data } = body || {};

    if (type !== 'email.received') {
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    const {
      from, // { name: string, email: string } or string
      to,   // [{ email: string, name?: string }] | string
      subject,
      text,
      html,
      headers,
    } = data || {};

    // Normalize sender fields
    const candidateEmail = typeof from === 'string' ? from : from?.email;
    const candidateName = typeof from === 'object' ? (from?.name || candidateEmail) : candidateEmail;

    // Determine recipient and org slug from recipient email
    const recipientEmail = Array.isArray(to) ? to[0]?.email : to;
    if (!recipientEmail || typeof recipientEmail !== 'string') {
      return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });
    }

    const match = recipientEmail.match(/^(.+)@wathefni\.ai$/i);
    if (!match) {
      return NextResponse.json({ error: 'Recipient domain unsupported' }, { status: 400 });
    }
    const orgSlug = match[1];

    // Resolve organization
    const orgRes = await sql`SELECT id::uuid as id, name FROM public.organizations WHERE slug = ${orgSlug} LIMIT 1`;
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const org = orgRes.rows[0] as { id: string; name: string };

    // Try to match existing thread by candidate email (newest first)
    const existingThreadRes = await sql`
      SELECT id::uuid as id
      FROM public.inbox_threads
      WHERE organization_id = ${org.id}::uuid
        AND candidate_email = ${candidateEmail}
        AND is_archived = FALSE
      ORDER BY last_message_at DESC
      LIMIT 1
    `;

    let threadId: string;
    if (existingThreadRes.rows.length) {
      threadId = existingThreadRes.rows[0].id as string;
    } else {
      // Create a new thread
      const insertThreadRes = await sql`
        INSERT INTO public.inbox_threads (
          organization_id, subject, candidate_name, candidate_email, unread_count
        ) VALUES (
          ${org.id}::uuid,
          ${subject || 'No subject'},
          ${candidateName || candidateEmail},
          ${candidateEmail},
          1
        )
        RETURNING id::uuid as id
      `;
      threadId = insertThreadRes.rows[0].id as string;
    }

    // Insert incoming message
    const content = (text || html || '').toString();
    await sql`
      INSERT INTO public.inbox_messages (
        thread_id, from_type, from_name, from_email, content, is_read
      ) VALUES (
        ${threadId}::uuid, 'candidate', ${candidateName}, ${candidateEmail}, ${content}, FALSE
      )
    `;

    // Notify first admin of the org
    const adminEmail = await getOrgAdminEmail(org.id);
    if (adminEmail) {
      await notifyAdminOfNewMessage({
        adminEmail,
        candidateName: candidateName || candidateEmail,
        subject: subject || 'No subject',
        messagePreview: content.substring(0, 300),
        orgSlug,
        threadId,
      });
    }

    return NextResponse.json({ success: true, threadId, orgSlug });
  } catch (err) {
    console.error('[INBOX] Webhook error:', err);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
