import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { parseEmailForCandidate, normalizeWatheeftiValues } from '@/lib/email-parser'

/**
 * Email webhook endpoint for automatic CV import
 * Receives forwarded emails from Resend Inbound or similar services
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface EmailAttachment {
  filename: string
  content: string // base64
  contentType: string
}

interface InboundEmail {
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Parse email payload (Resend Inbound format)
    // Resend wraps email data in { type: 'email.received', data: {...} }
    const rawPayload = await request.json()
    const payload: InboundEmail = rawPayload.data || rawPayload
    
    console.log('[EMAIL_IMPORT] Received email:', {
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      attachmentCount: payload.attachments?.length || 0
    })

    // Validate required fields
    if (!payload.to || !payload.from) {
      console.log('[EMAIL_IMPORT] Missing required fields, skipping')
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        reason: 'Missing required email fields'
      }, { status: 200 })
    }

    // Skip if this is a reply (not a CV submission)
    const subject = payload.subject || ''
    const isReply = /^(re|fw|fwd):/i.test(subject.trim())
    
    if (isReply) {
      console.log('[EMAIL_IMPORT] Skipping - this is a reply, not a CV import')
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        reason: 'Email is a reply, not a CV import'
      }, { status: 200 })
    }

    // Extract organization from recipient email
    // Format: knet@import.wathefni.ai or hr@org-slug.wathefni.ai
    const recipientEmail = String(payload.to || '').toLowerCase()
    const orgSlug = extractOrgSlug(recipientEmail)
    
    if (!orgSlug) {
      console.error('[EMAIL_IMPORT] Invalid recipient email:', recipientEmail)
      return NextResponse.json(
        { error: 'Invalid recipient email format' },
        { status: 400 }
      )
    }

    // Verify organization exists
    const orgResult = await sql`
      SELECT id, name FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `
    
    if (orgResult.rows.length === 0) {
      console.error('[EMAIL_IMPORT] Organization not found:', orgSlug)
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    const orgId = orgResult.rows[0].id
    const orgName = orgResult.rows[0].name

    // Parse email body to extract candidate information
    const emailText = payload.text || payload.html || ''
    const senderEmail = extractEmail(payload.from)
    
    const parsedData = await parseEmailForCandidate(emailText, senderEmail)
    console.log('[EMAIL_IMPORT] Parsed candidate data:', parsedData)

    // Find PDF attachment
    const pdfAttachment = payload.attachments?.find(
      a => a.contentType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf')
    )

    let cvBlobKey: string | null = null
    let cvFilename: string | null = null

    if (pdfAttachment) {
      // Upload PDF to Vercel Blob
      const buffer = Buffer.from(pdfAttachment.content, 'base64')
      const timestamp = Date.now()
      const sanitizedFilename = pdfAttachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      const blobPath = `cvs/${orgSlug}/${timestamp}-${sanitizedFilename}`

      console.log('[EMAIL_IMPORT] Uploading PDF to blob:', blobPath)
      
      const blob = await put(blobPath, buffer, {
        access: 'public',
        contentType: 'application/pdf'
      })

      cvBlobKey = blob.url
      cvFilename = pdfAttachment.filename
      console.log('[EMAIL_IMPORT] PDF uploaded:', blob.url)
    } else {
      console.warn('[EMAIL_IMPORT] No PDF attachment found')
    }

    // Normalize Watheefti taxonomy
    const normalized = normalizeWatheeftiValues(parsedData)

    // Create candidate in database
    const candidateResult = await sql`
      INSERT INTO candidates (
        org_id,
        email,
        full_name,
        phone,
        field_of_study,
        area_of_interest,
        gpa,
        degree,
        years_of_experience,
        cv_blob_key,
        cv_type,
        parse_status,
        source,
        knet_profile,
        created_at
      ) VALUES (
        ${orgId}::uuid,
        ${parsedData.email},
        ${parsedData.full_name},
        ${parsedData.phone},
        ${parsedData.field_of_study},
        ${parsedData.area_of_interest},
        ${parsedData.gpa},
        ${normalized.degree},
        ${normalized.yearsOfExperience},
        ${cvBlobKey},
        'uploaded',
        ${cvBlobKey ? 'queued' : 'pending'}::parse_status_enum,
        'email_import',
        ${JSON.stringify({
          degreeBucket: normalized.degree,
          yearsOfExperienceBucket: normalized.yearsOfExperience,
          areaOfInterest: normalized.areaOfInterest
        })},
        NOW()
      )
      RETURNING id, email, full_name
    `

    const candidate = candidateResult.rows[0]
    console.log('[EMAIL_IMPORT] Created candidate:', candidate.id)

    // Trigger CV parsing if attachment exists
    if (cvBlobKey && process.env.INTERNAL_API_TOKEN) {
      try {
        const parseUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/${orgSlug}/admin/cv/parse/${candidate.id}`
        
        fetch(parseUrl, {
          method: 'POST',
          headers: {
            'x-internal-token': process.env.INTERNAL_API_TOKEN
          }
        }).catch(err => {
          console.error('[EMAIL_IMPORT] Parse trigger failed:', err)
        })
        
        console.log('[EMAIL_IMPORT] Triggered CV parsing for:', candidate.id)
      } catch (err) {
        console.error('[EMAIL_IMPORT] Failed to trigger parsing:', err)
      }
    }

    // Log import event
    await sql`
      INSERT INTO import_log (org_id, source, source_email, candidate_count, success_count, created_at)
      VALUES (${orgId}::uuid, 'email_import', ${senderEmail}, 1, 1, NOW())
    `.catch(err => console.error('[EMAIL_IMPORT] Log insert failed:', err))

    // Send confirmation email to candidate (async, don't wait)
    sendConfirmationEmail(parsedData.email || senderEmail, parsedData.full_name, orgName).catch(err => {
      console.error('[EMAIL_IMPORT] Confirmation email failed:', err)
    })

    const processingTime = Date.now() - startTime
    console.log(`[EMAIL_IMPORT] Success! Processed in ${processingTime}ms`)

    return NextResponse.json({
      success: true,
      candidate_id: candidate.id,
      email: candidate.email,
      name: candidate.full_name,
      has_cv: !!cvBlobKey,
      parse_status: cvBlobKey ? 'queued' : 'pending',
      processing_time_ms: processingTime
    })

  } catch (error: any) {
    console.error('[EMAIL_IMPORT] Error:', error)
    return NextResponse.json(
      { 
        error: 'Import failed', 
        message: error?.message,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * Extract organization slug from email address
 * Formats: knet@import.wathefni.ai or hr@org-slug.wathefni.ai
 */
function extractOrgSlug(email: string): string | null {
  // Match: anything@import.wathefni.ai or anything@org-slug.wathefni.ai
  const match = email.match(/^[^@]+@(?:import\.wathefni\.ai|([^@.]+)\.wathefni\.ai)$/)
  
  if (match && match[1]) {
    // Format: hr@org-slug.wathefni.ai
    return match[1]
  } else if (email.includes('@import.wathefni.ai')) {
    // Format: knet@import.wathefni.ai
    const localPart = email.split('@')[0]
    return localPart // Use local part as org slug
  }
  
  return null
}

/**
 * Extract email address from "Name <email@example.com>" format
 */
function extractEmail(fromField: string): string {
  const match = fromField.match(/<([^>]+)>/)
  return match ? match[1] : fromField
}

/**
 * Send confirmation email to candidate
 */
async function sendConfirmationEmail(
  candidateEmail: string | null,
  candidateName: string | null,
  orgName: string
) {
  if (!candidateEmail || !process.env.RESEND_API_KEY) return

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)

    await resend.emails.send({
      from: process.env.RESEND_FROM || 'noreply@wathefni.ai',
      to: candidateEmail,
      subject: `Application Received - ${orgName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Thank you for your application!</h2>
          <p>Dear ${candidateName || 'Applicant'},</p>
          <p>We have successfully received your CV and application materials for <strong>${orgName}</strong>.</p>
          <p>Our team will review your application and contact you if your qualifications match our requirements.</p>
          <br>
          <p>Best regards,<br>${orgName} Hiring Team</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This email was sent via <a href="https://wathefni.ai">Wathefni AI</a> recruitment platform.
          </p>
        </div>
      `
    })

    console.log('[EMAIL_IMPORT] Confirmation email sent to:', candidateEmail)
  } catch (error) {
    console.error('[EMAIL_IMPORT] Failed to send confirmation:', error)
  }
}
