import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'
import { Resend } from 'resend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  req: NextRequest,
  { params }: { params: { org: string; threadId: string } }
) {
  try {
    // Verify admin auth
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

    // Get org
    const orgResult = await sql`
      SELECT id, name FROM organizations WHERE slug = ${params.org}
    `
    
    if (!orgResult.rows.length) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    
    const org = orgResult.rows[0]
    const body = await req.json()
    const { content } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Get thread details
    const threadResult = await sql`
      SELECT candidate_name, candidate_email, subject
      FROM inbox_threads
      WHERE id = ${params.threadId}::uuid
        AND organization_id = ${org.id}::uuid
    `

    if (!threadResult.rows.length) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const thread = threadResult.rows[0]

    // Insert reply message
    await sql`
      INSERT INTO inbox_messages (
        thread_id,
        from_type,
        from_name,
        from_email,
        content
      ) VALUES (
        ${params.threadId}::uuid,
        'admin',
        ${decoded.email || 'Admin'},
        ${params.org}@wathefni.ai,
        ${content.trim()}
      )
    `

    // Send email to candidate
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: `${org.name} <${params.org}@wathefni.ai>`,
          to: thread.candidate_email,
          subject: `Re: ${thread.subject}`,
          text: content.trim(),
          replyTo: `${params.org}@wathefni.ai`
        })
      } catch (emailError) {
        console.error('[INBOX_REPLY] Email send failed:', emailError)
        // Don't fail the request if email fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INBOX_REPLY] Error:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}
