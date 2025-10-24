/**
 * Email notifications for inbox messages
 * Sends alerts to admin's real email when candidates reply
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface NotifyAdminParams {
  adminEmail: string;
  adminName?: string;
  candidateName: string;
  subject: string;
  messagePreview: string;
  orgSlug: string;
  threadId: string;
}

/**
 * Send email notification to admin when candidate replies
 */
export async function notifyAdminOfNewMessage(params: NotifyAdminParams) {
  const {
    adminEmail,
    adminName,
    candidateName,
    subject,
    messagePreview,
    orgSlug,
    threadId,
  } = params;

  // Build dashboard link
  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/${orgSlug}/admin/inbox?thread=${threadId}`;

  try {
    await resend.emails.send({
      from: 'Wathefni AI <notifications@yourdomain.com>', // Update with your verified domain
      to: adminEmail,
      subject: `New message from ${candidateName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
              <h2 style="margin: 0 0 16px 0; color: #111;">New message in your inbox</h2>
              <p style="margin: 0; color: #666;">
                ${adminName ? `Hi ${adminName}, ` : ''}You have a new message from <strong>${candidateName}</strong>.
              </p>
            </div>

            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <div style="margin-bottom: 12px;">
                <strong style="color: #111;">Subject:</strong> ${subject}
              </div>
              <div style="color: #666; font-size: 14px; line-height: 1.5;">
                ${messagePreview.substring(0, 200)}${messagePreview.length > 200 ? '...' : ''}
              </div>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; background: #111; color: white; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 500;">
                View in Dashboard
              </a>
            </div>

            <div style="text-align: center; color: #999; font-size: 12px; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0;">Wathefni AI • Candidate Management System</p>
              <p style="margin: 8px 0 0 0;">
                <a href="${dashboardUrl}" style="color: #666; text-decoration: none;">Manage your inbox</a>
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
New message from ${candidateName}

Subject: ${subject}

${messagePreview}

View in dashboard: ${dashboardUrl}

---
Wathefni AI
      `.trim(),
    });

    console.log(`✅ Inbox notification sent to ${adminEmail}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send inbox notification:', error);
    // Don't throw - notification failure shouldn't break the inbox flow
    return { success: false, error };
  }
}

/**
 * Get admin email for an organization
 */
export async function getOrgAdminEmail(orgId: string): Promise<string | null> {
  const { sql } = await import('@vercel/postgres');

  try {
    const result = await sql`
      SELECT email 
      FROM admin_users 
      WHERE org_id = ${orgId}::uuid
      ORDER BY created_at ASC
      LIMIT 1
    `;

    return result.rows[0]?.email || null;
  } catch (error) {
    console.error('Failed to fetch admin email:', error);
    return null;
  }
}
