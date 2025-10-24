import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { put } from '@vercel/blob'
import { Resend } from 'resend'

// Prefer verified sender if provided; fallback to Resend sandbox domain
const EMAIL_FROM = process.env.RESEND_FROM || 'Watheefni AI <onboarding@resend.dev>'

// Resend webhook payload type (actual structure)
interface ResendInboundWebhook {
  type: string
  created_at: string
  data: {
    from: string
    to: string[]
    subject: string
    text?: string
    html?: string
    email_id: string
    attachments?: Array<{
      id: string
      filename: string
      content_type: string
      content_disposition: string
    }>
  }
}

// Helper: detect whether candidates table uses organization_id or org_id
async function getCandidatesOrgColumn(): Promise<'organization_id'|'org_id'> {
  try {
    const res = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'candidates'
        AND column_name IN ('organization_id','org_id')
    `
    const cols = res.rows.map((r: any) => r.column_name as string)
    return cols.includes('organization_id') ? 'organization_id' : 'org_id'
  } catch {
    return 'org_id'
  }
}

// Helper: extract org slugs from subject line
// Supports formats like: "Application - KNET - John Doe", "CV for NBK", "Apply to KNET, Boubyan"
function extractOrgSlugsFromSubject(subject: string): string[] {
  const slugs: string[] = []
  const lower = subject.toLowerCase()
  
  // Common org slug patterns (add more as needed)
  const knownSlugs = ['knet', 'nbk', 'boubyan', 'stc', 'zain', 'careerly', 'octupus']
  
  for (const slug of knownSlugs) {
    if (lower.includes(slug)) {
      slugs.push(slug)
    }
  }
  
  // Also try to extract from patterns like "Application - KNET -" or "CV for NBK"
  const matches = subject.match(/(?:application|cv|apply|for|to)[\s\-:]+([a-z0-9\-_]+)/gi)
  if (matches) {
    for (const match of matches) {
      const extracted = match.replace(/(?:application|cv|apply|for|to)[\s\-:]+/gi, '').trim().toLowerCase()
      if (extracted && extracted.length > 1 && extracted.length < 30) {
        if (!slugs.includes(extracted)) {
          slugs.push(extracted)
        }
      }
    }
  }
  
  return slugs
}

export async function POST(request: NextRequest) {
  try {
    // Ensure @vercel/postgres can connect even if only DATABASE_URL is set
    if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
      process.env.POSTGRES_URL = process.env.DATABASE_URL
    }
    const webhook: ResendInboundWebhook = await request.json()
    const email = webhook.data
    
    console.log('[INBOUND CV] Received email from:', email.from)
    console.log('[INBOUND CV] Subject:', email.subject)
    console.log('[INBOUND CV] Attachments:', email.attachments?.length || 0)
    console.log('[INBOUND CV] Full payload:', JSON.stringify(webhook, null, 2))
    
    // Extract sender info
    const senderEmail = email.from
    const senderName = extractNameFromEmail(email.subject, senderEmail)
    
    // Find PDF attachment
    const cvAttachment = email.attachments?.find(
      (a) => a.content_type === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf')
    )
    
    if (!cvAttachment) {
      console.error('[INBOUND CV] No PDF attachment found')
      console.error('[INBOUND CV] Available attachments:', email.attachments?.map(a => ({ filename: a.filename, type: a.content_type })))
      await sendErrorEmail(senderEmail, senderName, 'no-pdf')
      return NextResponse.json({ 
        success: false,
        error: 'No PDF attachment found',
        message: 'Error email sent to sender'
      }, { status: 200 }) // Return 200 so Resend knows webhook was received
    }
    
    // Fetch attachment content via SDK: list + download_url
    console.log('[INBOUND CV] Fetching attachment content from Resend SDK...')
    if (!process.env.RESEND_API_KEY) {
      console.error('[INBOUND CV] RESEND_API_KEY is missing')
      await sendErrorEmail(senderEmail, senderName, 'database-error')
      return NextResponse.json({ success: false, error: 'Missing RESEND_API_KEY' }, { status: 200 })
    }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data: attListResp, error: listErr } = await (resend as any).attachments.receiving.list({ emailId: email.email_id })
    if (listErr) {
      console.error('[INBOUND CV] Resend SDK attachments.receiving.list error:', listErr)
      await sendErrorEmail(senderEmail, senderName, 'database-error')
      return NextResponse.json({ success: false, error: 'Failed to list attachments via SDK' }, { status: 200 })
    }
    const attList = Array.isArray(attListResp) ? attListResp : (attListResp as any)?.data || []
    if (attList.length === 0) {
      console.error('[INBOUND CV] No attachments returned from SDK list')
      await sendErrorEmail(senderEmail, senderName, 'no-pdf')
      return NextResponse.json({ success: false, error: 'No attachments in SDK response' }, { status: 200 })
    }
    const chosen = attList.find((a: any) => a?.id === cvAttachment.id) 
      || attList.find((a: any) => (a?.content_type === 'application/pdf') || String(a?.filename || '').toLowerCase().endsWith('.pdf'))
    if (!chosen || !chosen.download_url) {
      console.error('[INBOUND CV] No downloadable PDF attachment found from SDK list')
      await sendErrorEmail(senderEmail, senderName, 'no-pdf')
      return NextResponse.json({ success: false, error: 'No downloadable PDF attachment found' }, { status: 200 })
    }
    const dlResp = await fetch(chosen.download_url)
    if (!dlResp.ok) {
      const txt = await dlResp.text().catch(() => '(no body)')
      console.error('[INBOUND CV] Failed to download attachment via download_url:', dlResp.status, txt)
      await sendErrorEmail(senderEmail, senderName, 'database-error')
      return NextResponse.json({ success: false, error: 'Failed to download attachment', status: dlResp.status }, { status: 200 })
    }
    const pdfBuffer = Buffer.from(await dlResp.arrayBuffer())
    
    // Check file size (max 10MB)
    if (pdfBuffer.length > 10 * 1024 * 1024) {
      console.error('[INBOUND CV] File too large:', pdfBuffer.length)
      await sendErrorEmail(senderEmail, senderName, 'file-too-large')
      return NextResponse.json({ 
        success: false,
        error: 'File too large (max 10MB)',
        message: 'Error email sent to sender'
      }, { status: 200 }) // Return 200 so Resend doesn't retry
    }
    
    // Upload PDF to Vercel Blob
    console.log('[INBOUND CV] Uploading PDF to Vercel Blob...')
    const timestamp = Date.now()
    const sanitizedFilename = cvAttachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    let blobUrl: string | null = null
    try {
      const blob = await put(`cvs/${timestamp}-${sanitizedFilename}`, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf'
      })
      blobUrl = blob.url
      console.log('[INBOUND CV] PDF uploaded:', blobUrl)
    } catch (err) {
      console.error('[INBOUND CV] Blob upload failed:', (err as any)?.message || err)
      await sendErrorEmail(senderEmail, senderName, 'database-error')
      return NextResponse.json({
        success: false,
        error: 'Blob upload failed',
        details: (err as any)?.message
      }, { status: 200 })
    }
    
    // Parse subject for org targeting (e.g., "Application - KNET - John Doe")
    const targetedOrgSlugs = extractOrgSlugsFromSubject(email.subject)
    console.log('[INBOUND CV] Targeted org slugs from subject:', targetedOrgSlugs)
    
    // Get organizations (targeted or all public)
    console.log('[INBOUND CV] Loading organizations...')
    let orgs
    try {
      // Check if deleted_at column exists
      const colCheck = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'deleted_at'
      `
      const hasDeletedAt = colCheck.rows.length > 0
      
      if (targetedOrgSlugs.length > 0) {
        // Add to specific orgs only
        console.log('[INBOUND CV] Targeting specific organizations:', targetedOrgSlugs)
        const slugsList = `{${targetedOrgSlugs.join(',')}}`
        if (hasDeletedAt) {
          orgs = await sql`
            SELECT id, slug, name FROM organizations 
            WHERE LOWER(slug) = ANY(${slugsList}::text[]) 
              AND deleted_at IS NULL
          `
        } else {
          orgs = await sql`
            SELECT id, slug, name FROM organizations 
            WHERE LOWER(slug) = ANY(${slugsList}::text[])
          `
        }
      } else {
        // Fallback: add to all public orgs
        console.log('[INBOUND CV] No specific orgs targeted, adding to all public orgs')
        if (hasDeletedAt) {
          orgs = await sql`
            SELECT id, slug, name FROM organizations WHERE is_public = true AND deleted_at IS NULL
          `
        } else {
          orgs = await sql`
            SELECT id, slug, name FROM organizations WHERE is_public = true
          `
        }
      }
    } catch (err) {
      console.error('[INBOUND CV] Failed to load organizations:', (err as any)?.message || err)
      return NextResponse.json({
        success: false,
        error: 'Failed to load organizations',
        details: (err as any)?.message
      }, { status: 200 })
    }
    
    if (orgs.rows.length === 0) {
      console.error('[INBOUND CV] No public organizations found')
      await sendErrorEmail(senderEmail, senderName, 'no-orgs')
      return NextResponse.json({ 
        success: false,
        error: 'No organizations available',
        message: 'Error email sent to sender'
      }, { status: 200 })
    }
    
    // Add candidate to all public organizations
    const candidateIds: string[] = []
    const orgCol = await getCandidatesOrgColumn()
    console.log('[INBOUND CV] Using candidates column for org:', orgCol)

    for (const org of orgs.rows) {
      try {
        const result = orgCol === 'organization_id'
          ? await sql`
              INSERT INTO candidates (
                organization_id,
                full_name,
                email,
                cv_blob_key,
                cv_type,
                parse_status,
                created_at
              ) VALUES (
                ${org.id}::uuid,
                ${senderName},
                ${senderEmail},
                ${blobUrl},
                'uploaded',
                'pending',
                now()
              )
              RETURNING id::text
            `
          : await sql`
              INSERT INTO candidates (
                org_id,
                full_name,
                email,
                cv_blob_key,
                cv_type,
                parse_status,
                created_at
              ) VALUES (
                ${org.id}::uuid,
                ${senderName},
                ${senderEmail},
                ${blobUrl},
                'uploaded',
                'pending',
                now()
              )
              RETURNING id::text
            `
        
        candidateIds.push(result.rows[0].id)
        console.log(`[INBOUND CV] Added to ${org.name} (${org.slug}): ${result.rows[0].id}`)
      } catch (error) {
        console.error(`[INBOUND CV] Failed to add to ${org.name}:`, error)
      }
    }
    
    if (candidateIds.length === 0) {
      console.error('[INBOUND CV] Failed to add to any organization')
      await sendErrorEmail(senderEmail, senderName, 'database-error')
      return NextResponse.json({ 
        success: false,
        error: 'Failed to process CV',
        message: 'Error email sent to sender'
      }, { status: 200 })
    }
    
    // Send success confirmation email
    await sendSuccessEmail(
      senderEmail, 
      senderName, 
      orgs.rows.map(o => o.name)
    )
    
    console.log(`[INBOUND CV] Success! Added to ${candidateIds.length} organizations`)
    
    // Fire-and-forget: trigger CV parsing if enabled
    if (String(process.env.AUTO_PARSE_ON_UPLOAD || '').toLowerCase() === 'true') {
      console.log('[INBOUND CV] AUTO_PARSE_ON_UPLOAD enabled, triggering parsing...')
      const internal = (process.env.INTERNAL_API_TOKEN || '').trim()
      
      for (let i = 0; i < orgs.rows.length; i++) {
        const org = orgs.rows[i]
        const candidateId = candidateIds[i]
        
        try {
          const parseUrl = new URL(`/api/${org.slug}/admin/cv/parse`, request.url).toString()
          console.log(`[INBOUND CV] Triggering parse for ${org.slug}: ${candidateId}`)
          
          // Fire-and-forget: don't await
          fetch(parseUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(internal ? { 'x-internal-token': internal } : {})
            },
            body: JSON.stringify({ candidateId })
          }).catch((err) => {
            console.error(`[INBOUND CV] Parse trigger failed for ${org.slug}:`, err)
          })
        } catch (err) {
          console.error(`[INBOUND CV] Failed to trigger parse for ${org.slug}:`, err)
        }
      }
    }
    
    return NextResponse.json({ 
      success: true,
      candidateIds,
      organizations: orgs.rows.length,
      message: 'CV processed and confirmation email sent'
    })
    
  } catch (error) {
    console.error('[INBOUND CV] Error processing email:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: (error as any)?.message 
    }, { status: 200 })
  }
}

// Extract name from email subject or sender
function extractNameFromEmail(subject: string, from: string): string {
  // Try to extract from subject (e.g., "Application - John Doe")
  const subjectMatch = subject.match(/(?:application|cv|resume|test)[\s\-:]+(.+)/i)
  if (subjectMatch) {
    const name = subjectMatch[1].trim()
    if (name && name.length > 2) return name
  }
  
  // Try to extract from email address (e.g., "john.doe@gmail.com" -> "John Doe")
  const emailName = from.split('@')[0]
  const nameParts = emailName.split(/[._-]/)
  const capitalizedParts = nameParts.map(part => 
    part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
  )
  
  return capitalizedParts.join(' ')
}

// Send error email to sender
async function sendErrorEmail(
  to: string, 
  name: string, 
  errorType: 'no-pdf' | 'file-too-large' | 'no-orgs' | 'database-error'
) {
  const errorMessages = {
    'no-pdf': {
      subject: 'CV Submission Error - No PDF Found',
      message: 'We couldn\'t find a PDF attachment in your email. Please make sure you attach your CV as a PDF file.'
    },
    'file-too-large': {
      subject: 'CV Submission Error - File Too Large',
      message: 'Your CV file is too large (maximum 10MB). Please compress your PDF and try again.'
    },
    'no-orgs': {
      subject: 'CV Submission Error - Service Unavailable',
      message: 'Our service is temporarily unavailable. Please try again later or visit our website.'
    },
    'database-error': {
      subject: 'CV Submission Error - Processing Failed',
      message: 'We encountered an error processing your CV. Please try again or visit our website.'
    }
  }
  
  const error = errorMessages[errorType]
  
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[INBOUND CV] RESEND_API_KEY not set, skipping error email')
      return
    }
    
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: error.subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">CV Submission Error</h2>
            <p>Hi ${name},</p>
            <p>${error.message}</p>
            <p><strong>What to do:</strong></p>
            <ul>
              <li>Make sure your CV is in PDF format</li>
              <li>File size should be under 10MB</li>
              <li>Attach the file to your email</li>
            </ul>
            <p>Or visit our website to submit your CV: <a href="https://watheefni.ai/start">https://watheefni.ai/start</a></p>
            <p>Best regards,<br>Watheefni AI Team</p>
          </div>
        `
      })
    })
    
    console.log('[INBOUND CV] Error email sent to:', to)
  } catch (e) {
    console.error('[INBOUND CV] Failed to send error email:', e)
  }
}

// Send success confirmation email
async function sendSuccessEmail(
  to: string, 
  name: string, 
  organizations: string[]
) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[INBOUND CV] RESEND_API_KEY not set, skipping success email')
      return
    }
    
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: 'CV Received Successfully ✓',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">✓ CV Received Successfully</h2>
            <p>Hi ${name},</p>
            <p>We've successfully received your CV and added you to our candidate database.</p>
            <p><strong>Your profile has been submitted to:</strong></p>
            <ul>
              ${organizations.map(org => `<li>${org}</li>`).join('')}
            </ul>
            <p>Our AI will analyze your CV and match you with relevant opportunities. You'll be notified when positions that match your profile become available.</p>
            <p><strong>What happens next:</strong></p>
            <ol>
              <li>Your CV will be analyzed by our AI</li>
              <li>You'll be matched with relevant job opportunities</li>
              <li>Organizations will be able to view your profile</li>
              <li>You'll receive notifications for matching positions</li>
            </ol>
            <p>Thank you for using Watheefni AI!</p>
            <p>Best regards,<br>Watheefni AI Team</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #6b7280;">
              Visit our website: <a href="https://watheefni.ai">watheefni.ai</a>
            </p>
          </div>
        `
      })
    })
    
    console.log('[INBOUND CV] Success email sent to:', to)
  } catch (e) {
    console.error('[INBOUND CV] Failed to send success email:', e)
  }
}
