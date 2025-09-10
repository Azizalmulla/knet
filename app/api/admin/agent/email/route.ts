import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Email template schema
const EmailGeneratorSchema = z.object({
  type: z.enum(['shortlist', 'reject', 'interview', 'offer']),
  candidateName: z.string(),
  candidateEmail: z.string(),
  roleTitle: z.string(),
  companyName: z.string().default('KNET'),
  reasons: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  interviewDate: z.string().optional(),
  customMessage: z.string().optional(),
});

// Verify admin auth
function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_KEY;
  
  if (!adminKey || !authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === adminKey;
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

// POST: Generate email template
export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const validated = EmailGeneratorSchema.parse(body);
    
    const template = generateEmailTemplate(validated);
    
    // Also return mailto link for easy sending
    const mailtoLink = `mailto:${validated.candidateEmail}?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}`;
    
    return NextResponse.json({
      success: true,
      template,
      mailtoLink,
      candidateEmail: validated.candidateEmail
    });
  } catch (error: any) {
    console.error('Failed to generate email:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request data',
        details: error.errors 
      }, { status: 400 });
    }
    return NextResponse.json({ 
      error: 'Failed to generate email template' 
    }, { status: 500 });
  }
}
