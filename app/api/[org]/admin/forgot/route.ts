import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'
import { sendEmail } from '@/lib/email'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function POST(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  let body: any = {}
  try {
    body = await request.json()
  } catch {}
  const email: string = (body?.email || '').toString().trim()

  // Rate limit: 5 per 15 minutes per IP+email combo
  const rateKey = `${clientIp}-${email || 'unknown'}`
  const rl = checkRateLimitWithConfig(request, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    namespace: `admin-forgot-${rateKey}`
  })
  if (!rl.success) return createRateLimitResponse(rl)

  try {
    // Resolve org
    const orgRes = await sql`SELECT id::text FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) {
      // Avoid enumeration; return generic success
      return NextResponse.json({ success: true })
    }
    const orgId = orgRes.rows[0].id

    // Lookup admin (avoid leaking existence)
    const adminRes = await sql`
      SELECT id::text FROM admin_users 
      WHERE org_id = ${orgId}::uuid AND email_lc = ${email.toLowerCase()} 
      LIMIT 1`

    if (!adminRes.rows.length) {
      // Always respond success to avoid account enumeration
      return NextResponse.json({ success: true })
    }

    const adminId = adminRes.rows[0].id as string

    // Create token (random 32 bytes hex)
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await sql`
      INSERT INTO admin_password_resets (admin_id, org_id, token_hash, expires_at)
      VALUES (${adminId}::uuid, ${orgId}::uuid, ${tokenHash}, ${expiresAt.toISOString()}::timestamptz)
    `

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin
    const resetUrl = `${baseUrl}/${orgSlug}/admin/reset?token=${token}`

    // Send email (Resend or SendGrid if configured). Falls back to console log.
    try {
      const html = `
        <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#111">
          <h2 style="margin:0 0 12px">Reset your Careerly admin password</h2>
          <p>We received a request to reset the password for <strong>${email}</strong> at <strong>${orgSlug}</strong>.</p>
          <p>Click the button below to choose a new password. This link expires in 1 hour.</p>
          <p style="margin:20px 0"><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:999px;text-decoration:none">Reset password</a></p>
          <p>If you did not request this, you can safely ignore this email.</p>
        </div>`
      await sendEmail({ to: email, subject: 'Reset your Careerly admin password', html })
    } catch (e) {
      // Non-fatal: email provider not configured or failed
      console.warn('EMAIL_SEND_ERROR', e)
    }

    console.log(`[AUDIT] Password reset created for ${email} at org ${orgSlug} from ${clientIp}. Reset URL: ${resetUrl}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Failed to start reset' }, { status: 500 })
  }
}
