import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { jwtVerify } from '@/lib/esm-compat/jose';
import { sql } from '@vercel/postgres';

// Email template schema
const EmailGeneratorSchema = z.object({
  type: z.enum(['shortlist', 'reject', 'interview', 'offer']),
  candidateName: z.string(),
  candidateEmail: z.string(),
  roleTitle: z.string(),
  companyName: z.string().default('Wathefni AI'),
  reasons: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  interviewDate: z.string().optional(),
  customMessage: z.string().optional(),
});

// Verify admin auth
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production';

async function getAuthContext(request: NextRequest): Promise<{ authorized: boolean; orgSlug?: string; orgName?: string }>
{
  // Path A: Legacy header key (dev/legacy)
  const provided = (request.headers.get('x-admin-key') || '').trim();
  const envKey = (process.env.ADMIN_KEY || '').trim();
  const fallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : '';
  if (provided && [envKey, fallback].filter(Boolean).includes(provided)) {
    // Org will be derived from body or default later
    return { authorized: true };
  }

  // Path B: Org-scoped admin session via cookie (recommended)
  try {
    let session = request.cookies.get('admin_session')?.value;
    if (!session) {
      // Fallback to the server cookie store
      session = cookies().get('admin_session')?.value;
    }
    if (session) {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(session, secret);
      const orgSlug = String((payload as any)?.orgSlug || '').trim();
      if (orgSlug) {
        // Try to resolve org name
        let orgName: string | undefined;
        try {
          const res = await sql`SELECT name FROM public.organizations WHERE slug = ${orgSlug} LIMIT 1`;
          orgName = res?.rows?.[0]?.name as string | undefined;
        } catch {}
        return { authorized: true, orgSlug, orgName };
      }
    }
  } catch {}

  return { authorized: false };
}

// Generate email templates
function generateEmailTemplate(data: z.infer<typeof EmailGeneratorSchema>) {
  const { type, candidateName, roleTitle, companyName, reasons, gaps, interviewDate, customMessage } = data;
  
  const templates = {
    shortlist: {
      subject: `Congratulations! You've been shortlisted for ${roleTitle} at ${companyName}`,
      body: `Dear ${candidateName},

We are pleased to inform you that your application for the ${roleTitle} position at ${companyName} has been shortlisted.

${reasons && reasons.length > 0 ? `What impressed us about your application:
${reasons.map(r => `• ${r}`).join('\n')}
` : ''}
We were particularly impressed with your qualifications and experience, which align well with our requirements.

Next Steps:
We will be in touch soon to schedule an interview. Please ensure your contact information is up to date.

${customMessage ? `\n${customMessage}\n` : ''}
Thank you for your interest in joining ${companyName}.

Best regards,
HR Team
${companyName}`
    },
    
    reject: {
      subject: `Update on your ${roleTitle} application at ${companyName}`,
      body: `Dear ${candidateName},

Thank you for your interest in the ${roleTitle} position at ${companyName} and for taking the time to apply.

After careful consideration of all applications, we regret to inform you that we will not be moving forward with your application at this time.

${gaps && gaps.length > 0 ? `For your future applications, you might consider strengthening:
${gaps.map(g => `• ${g}`).join('\n')}
` : ''}
Please don't be discouraged by this decision. We encourage you to apply for future opportunities that match your qualifications.

${customMessage ? `\n${customMessage}\n` : ''}
We wish you the very best in your career search.

Best regards,
HR Team
${companyName}`
    },
    
    interview: {
      subject: `Interview Invitation - ${roleTitle} at ${companyName}`,
      body: `Dear ${candidateName},

Congratulations! We would like to invite you for an interview for the ${roleTitle} position at ${companyName}.

Interview Details:
Date: ${interviewDate || '[To be scheduled]'}
Format: [Virtual/In-person]
Duration: Approximately [X] minutes

${reasons && reasons.length > 0 ? `What stood out in your application:
${reasons.map(r => `• ${r}`).join('\n')}
` : ''}
Please confirm your availability by replying to this email. If the proposed time doesn't work for you, please suggest alternative times.

What to Prepare:
• Review the job description
• Prepare examples of your relevant experience
• Have questions ready about the role and company

${customMessage ? `\n${customMessage}\n` : ''}
We look forward to speaking with you!

Best regards,
HR Team
${companyName}`
    },
    
    offer: {
      subject: `Job Offer - ${roleTitle} at ${companyName}`,
      body: `Dear ${candidateName},

We are delighted to offer you the position of ${roleTitle} at ${companyName}!

${reasons && reasons.length > 0 ? `We were particularly impressed by:
${reasons.map(r => `• ${r}`).join('\n')}
` : ''}
Your qualifications and experience make you an excellent fit for our team, and we believe you will make valuable contributions to ${companyName}.

Next Steps:
• A formal offer letter with detailed terms will be sent separately
• Please review and sign the offer letter
• Complete any required onboarding documentation

${customMessage ? `\n${customMessage}\n` : ''}
We are excited about the possibility of you joining our team and look forward to your response.

Congratulations once again!

Best regards,
HR Team
${companyName}`
    }
  };
  
  return templates[type];
}

// POST: Send email via Resend
export async function POST(request: NextRequest) {
  // Accept either x-admin-key or admin_session cookie
  const auth = await getAuthContext(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { orgSlug: bodyOrgSlug, orgName: bodyOrgName, sendEmail = true, ...rest } = body;
    const validated = EmailGeneratorSchema.parse(rest);
    
    const template = generateEmailTemplate(validated);
    
    // If sendEmail is false, just return template (for preview)
    if (!sendEmail) {
      const mailtoLink = `mailto:${validated.candidateEmail}?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;
      return NextResponse.json({
        success: true,
        template,
        mailtoLink,
        candidateEmail: validated.candidateEmail
      });
    }

    // Send actual email via Resend
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ 
        error: 'Email service not configured. Set RESEND_API_KEY in environment.' 
      }, { status: 500 });
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Resolve org identity for sender
    const resolvedOrgSlug = (auth.orgSlug || bodyOrgSlug || '').trim();
    let resolvedOrgName = (auth.orgName || bodyOrgName || '').trim();
    if (!resolvedOrgName && resolvedOrgSlug) {
      try {
        const res = await sql`SELECT name FROM public.organizations WHERE slug = ${resolvedOrgSlug} LIMIT 1`;
        resolvedOrgName = res?.rows?.[0]?.name as string || '';
      } catch {}
    }

    const fromEmail = resolvedOrgSlug
      ? `${resolvedOrgSlug}@wathefni.ai`
      : (process.env.RESEND_FROM || 'hr@wathefni.ai');
    const fromName = resolvedOrgName ? `${resolvedOrgName} HR Team` : 'HR Team';

    // Auto per-org inbound address: each org gets {orgSlug}@fresh-antlion.resend.app
    const inboundDomain = process.env.RESEND_INBOUND_DOMAIN || 'fresh-antlion.resend.app';
    const replyToAddress = resolvedOrgSlug 
      ? `${resolvedOrgSlug}@${inboundDomain}`
      : `admin@${inboundDomain}`;

    const result = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: validated.candidateEmail,
      replyTo: replyToAddress, // ✅ Replies go to inbox webhook
      subject: template.subject,
      text: template.body,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
          ${template.body.split('\n').map(line => 
            line.trim() === '' ? '<br>' : `<p style="margin: 12px 0;">${line}</p>`
          ).join('')}
        </div>
      `,
    });

    const emailId = result.data?.id || 'unknown';
    console.log('✅ Email sent via Resend:', emailId);

    return NextResponse.json({
      success: true,
      emailId,
      template,
      candidateEmail: validated.candidateEmail,
      sentFrom: fromEmail,
    });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.errors 
      }, { status: 400 });
    }
    return NextResponse.json({ 
      error: error.message || 'Failed to send email' 
    }, { status: 500 });
  }
}
