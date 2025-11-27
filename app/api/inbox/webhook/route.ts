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
    console.log('[INBOX_WEBHOOK] ========== NEW WEBHOOK CALL ==========');
    
    // Optional: verify Svix headers (Resend)
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    console.log('[INBOX_WEBHOOK] Headers:', { svixId, svixTimestamp, hasSignature: !!svixSignature });
    
    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn('[INBOX] Webhook without Svix headers');
    }

    const body = await req.json();
    const { type, data } = body || {};
    console.log('[INBOX_WEBHOOK] Event type:', type);
    console.log('[INBOX_WEBHOOK] Data keys:', Object.keys(data || {}));
    console.log('[INBOX_WEBHOOK] Full data:', JSON.stringify(data, null, 2));

    if (type !== 'email.received') {
      console.log('[INBOX_WEBHOOK] Ignoring non-email event');
      return NextResponse.json({ received: true, ignored: true }, { status: 200 });
    }

    const {
      from,
      to,
      subject,
      text: webhookText,
      html: webhookHtml,
      email_id,
      attachments,
    } = data || {};
    
    // Skip emails with CV attachments (PDF/DOCX) - those are handled by /api/inbound/cv
    const hasCVAttachment = attachments?.some((a: any) => 
      a?.content_type === 'application/pdf' ||
      a?.filename?.toLowerCase().endsWith('.pdf') ||
      a?.content_type?.includes('wordprocessingml') ||
      a?.filename?.toLowerCase().endsWith('.docx')
    );
    
    if (hasCVAttachment) {
      console.log('[INBOX_WEBHOOK] Email has CV attachment - letting /api/inbound/cv handle it');
      return NextResponse.json({ received: true, skipped: true, reason: 'Has CV attachment' }, { status: 200 });
    }
    
    // Resend webhook may not include body - fetch it via API if missing
    let text = webhookText;
    let html = webhookHtml;
    
    if ((!text && !html) && email_id && process.env.RESEND_API_KEY) {
      console.log('[INBOX_WEBHOOK] Body missing, fetching via API for email_id:', email_id);
      try {
        const res = await fetch(`https://api.resend.com/emails/${email_id}`, {
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` }
        });
        if (res.ok) {
          const emailData = await res.json();
          text = emailData.text || '';
          html = emailData.html || '';
          console.log('[INBOX_WEBHOOK] Fetched body, text length:', text?.length || 0);
        }
      } catch (err) {
        console.error('[INBOX_WEBHOOK] Failed to fetch email body:', err);
      }
    }

    // Normalize sender fields
    const candidateEmail = typeof from === 'string' ? from : from?.email;
    const candidateName = typeof from === 'object' ? (from?.name || candidateEmail) : candidateEmail;
    console.log('[INBOX_WEBHOOK] From:', { candidateEmail, candidateName });

    // Determine recipient and org slug from recipient email
    // Handle both formats: ["email@domain.com"] or [{ email: "email@domain.com" }]
    let recipientEmail: string | undefined;
    if (Array.isArray(to)) {
      const first = to[0];
      recipientEmail = typeof first === 'string' ? first : first?.email;
    } else {
      recipientEmail = typeof to === 'string' ? to : to?.email;
    }
    console.log('[INBOX_WEBHOOK] To:', recipientEmail);
    
    if (!recipientEmail || typeof recipientEmail !== 'string') {
      console.error('[INBOX_WEBHOOK] Missing recipient email');
      return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });
    }

    // Support multiple inbound domains:
    // - @wathefni.ai (custom domain)
    // - @inbox.wathefni.ai (custom subdomain)
    // - @fresh-antlion.resend.app (Resend's default inbound domain)
    // - @*.resend.app (any Resend inbound domain)
    const inboundDomain = process.env.RESEND_INBOUND_DOMAIN || 'wathefni.ai';
    const patterns = [
      /^(.+)@(?:inbox\.)?wathefni\.ai$/i,           // Custom domain
      /^(.+)@fresh-antlion\.resend\.app$/i,         // Resend default
      new RegExp(`^(.+)@${inboundDomain.replace(/\./g, '\\.')}$`, 'i'), // Env configured domain
    ];
    
    let orgSlug: string | null = null;
    for (const pattern of patterns) {
      const match = recipientEmail.match(pattern);
      if (match) {
        orgSlug = match[1];
        break;
      }
    }
    
    if (!orgSlug) {
      console.error('[INBOX_WEBHOOK] Recipient domain not recognized:', recipientEmail);
      console.error('[INBOX_WEBHOOK] Expected domains: wathefni.ai, inbox.wathefni.ai, or', inboundDomain);
      return NextResponse.json({ error: 'Recipient domain unsupported' }, { status: 400 });
    }
    console.log('[INBOX_WEBHOOK] Extracted org slug:', orgSlug);

    // Resolve organization
    const orgRes = await sql`SELECT id::uuid as id, name FROM public.organizations WHERE slug = ${orgSlug} LIMIT 1`;
    if (!orgRes.rows.length) {
      console.error('[INBOX_WEBHOOK] Organization not found:', orgSlug);
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    const org = orgRes.rows[0] as { id: string; name: string };
    console.log('[INBOX_WEBHOOK] Found org:', org);

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
      console.log('[INBOX_WEBHOOK] Using existing thread:', threadId);
    } else {
      // Create a new thread
      console.log('[INBOX_WEBHOOK] Creating new thread for:', candidateEmail);
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
      console.log('[INBOX_WEBHOOK] Created thread:', threadId);
    }

    // Insert incoming message
    const content = (text || html || '').toString();
    console.log('[INBOX_WEBHOOK] Saving message, content length:', content.length);
    await sql`
      INSERT INTO public.inbox_messages (
        thread_id, from_type, from_name, from_email, content, is_read
      ) VALUES (
        ${threadId}::uuid, 'candidate', ${candidateName}, ${candidateEmail}, ${content}, FALSE
      )
    `;
    console.log('[INBOX_WEBHOOK] ✅ Message saved successfully!');

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
