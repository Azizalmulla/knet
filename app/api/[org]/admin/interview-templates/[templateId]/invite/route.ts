import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

// POST: Invite candidates to interview
export async function POST(
  req: NextRequest,
  { params }: { params: { org: string; templateId: string } }
) {
  try {
    const token = req.cookies.get('admin_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
    )
    
    let decoded: any
    try {
      const { payload } = await jwtVerify(token, secret)
      decoded = payload
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (decoded.orgSlug !== params.org) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get organization details
    const orgResult = await sql`
      SELECT id, name FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const orgId = orgResult.rows[0].id
    const orgName = orgResult.rows[0].name
    
    // Get template details
    const templateResult = await sql`
      SELECT title, description FROM interview_templates WHERE id = ${params.templateId}::uuid
    `
    
    if (!templateResult.rows.length) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    
    const templateTitle = templateResult.rows[0].title
    const templateDescription = templateResult.rows[0].description

    const body = await req.json()
    const { candidate_ids, expires_in_days } = body

    if (!candidate_ids || !Array.isArray(candidate_ids) || candidate_ids.length === 0) {
      return NextResponse.json({ error: 'Candidate IDs are required' }, { status: 400 })
    }

    const expiryDays = expires_in_days || 7
    const createdSessions = []
    const emailsSent = []
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wathefni.ai'

    for (const candidateId of candidate_ids) {
      // Check if session already exists
      const existingResult = await sql`
        SELECT id FROM interview_sessions
        WHERE template_id = ${params.templateId}::uuid
          AND candidate_id = ${candidateId}::uuid
          AND status != 'expired'
      `

      if (existingResult.rows.length > 0) {
        continue // Skip if already invited
      }

      // Get candidate details
      const candidateResult = await sql`
        SELECT full_name, email FROM candidates WHERE id = ${candidateId}::uuid
      `
      
      if (!candidateResult.rows.length) {
        continue
      }
      
      const candidateName = candidateResult.rows[0].full_name || 'Candidate'
      const candidateEmail = candidateResult.rows[0].email

      // Create session
      const sessionResult = await sql`
        INSERT INTO interview_sessions (
          org_id,
          template_id,
          candidate_id,
          status,
          expires_at
        )
        VALUES (
          ${orgId}::uuid,
          ${params.templateId}::uuid,
          ${candidateId}::uuid,
          'pending',
          NOW() + INTERVAL '${expiryDays} days'
        )
        RETURNING id
      `

      const sessionId = sessionResult.rows[0].id
      const interviewLink = `${baseUrl}/interview/${sessionId}`

      createdSessions.push({
        session_id: sessionId,
        candidate_id: candidateId
      })

      // Send email invitation
      if (resend && candidateEmail) {
        try {
          await resend.emails.send({
            from: `${orgName} <noreply@wathefni.ai>`,
            to: candidateEmail,
            subject: `You're Invited: Video Interview for ${orgName}`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: #000; color: #fff; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
                  .content { background: #fff; padding: 30px; border: 3px solid #000; border-top: none; border-radius: 0 0 12px 12px; }
                  .button { display: inline-block; background: #bde0fe; color: #000; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: bold; border: 3px solid #000; margin: 20px 0; }
                  .details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
                  .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0;">🎥 Video Interview Invitation</h1>
                  </div>
                  <div class="content">
                    <p>Hi ${candidateName},</p>
                    <p><strong>${orgName}</strong> would like you to complete a video interview!</p>
                    
                    <div class="details">
                      <p><strong>Interview:</strong> ${templateTitle}</p>
                      ${templateDescription ? `<p><strong>Description:</strong> ${templateDescription}</p>` : ''}
                      <p><strong>Expires:</strong> ${expiryDays} days from now</p>
                    </div>
                    
                    <p>This is an asynchronous video interview. You can complete it anytime before the expiry date, from any device with a camera.</p>
                    
                    <p style="text-align: center;">
                      <a href="${interviewLink}" class="button">Start Interview →</a>
                    </p>
                    
                    <p><strong>Tips for success:</strong></p>
                    <ul>
                      <li>Find a quiet place with good lighting</li>
                      <li>Test your camera and microphone beforehand</li>
                      <li>You can re-record each answer before submitting</li>
                      <li>Speak clearly and take your time</li>
                    </ul>
                    
                    <p>Good luck!</p>
                    <p>— The ${orgName} Team</p>
                  </div>
                  <div class="footer">
                    <p>This email was sent by Wathefni AI on behalf of ${orgName}</p>
                    <p>If you didn't apply for a position, you can ignore this email.</p>
                  </div>
                </div>
              </body>
              </html>
            `
          })
          emailsSent.push(candidateEmail)
        } catch (emailError) {
          console.error('[INTERVIEW_INVITE] Email failed for:', candidateEmail, emailError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      invited_count: createdSessions.length,
      emails_sent: emailsSent.length,
      sessions: createdSessions
    })
  } catch (error) {
    console.error('[INTERVIEW_INVITE] Error:', error)
    return NextResponse.json({ error: 'Failed to invite candidates' }, { status: 500 })
  }
}
