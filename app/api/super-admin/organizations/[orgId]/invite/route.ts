import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

function verifySuperAdmin(request: NextRequest) {
  const session = request.cookies.get('super_admin_session')?.value
  if (!session) return null
  try {
    const decoded = jwt.verify(session, JWT_SECRET) as any
    if (decoded.role !== 'super_admin') return null
    return decoded as { superAdminId?: string; email?: string }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = verifySuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = params.orgId
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  try {
    const body = await request.json() as { email: string; role?: 'owner'|'admin'|'viewer'; sendEmail?: boolean }
    const email = String(body?.email || '').trim()
    const role = (body?.role || 'admin') as 'owner'|'admin'|'viewer'
    const sendEmail = !!body?.sendEmail
    
    console.log(`[INVITE_ADMIN] Request: email=${email}, role=${role}, sendEmail=${sendEmail}, orgId=${orgId}`)
    
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

    // Verify org exists and fetch slug
    const org = await sql`SELECT id::text, slug, name FROM organizations WHERE id = ${orgId}::uuid LIMIT 1`
    if (!org.rows.length) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    const orgSlug = org.rows[0].slug as string

    // Create invite token (random URL-safe)
    const token = crypto.randomBytes(24).toString('base64url')
    const expiryEpoch = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days in seconds

    const createdBy = admin.superAdminId && admin.superAdminId !== 'env-super-admin' ? admin.superAdminId : null
    
    console.log(`[INVITE_ADMIN] Creating invite for ${email} to org ${orgId}`)
    
    // Insert with conditional UUID casting
    if (createdBy) {
      await sql`
        INSERT INTO admin_invites (organization_id, email, token, role, created_by, expires_at)
        VALUES (${orgId}::uuid, ${email}, ${token}, ${role}, ${createdBy}::uuid, to_timestamp(${expiryEpoch}))
      `
    } else {
      await sql`
        INSERT INTO admin_invites (organization_id, email, token, role, created_by, expires_at)
        VALUES (${orgId}::uuid, ${email}, ${token}, ${role}, NULL, to_timestamp(${expiryEpoch}))
      `
    }

    // Build invite URL
    const origin = new URL(request.url).origin
    const inviteUrl = `${origin}/${orgSlug}/admin/accept-invite?token=${token}`

    // Optional: send email if configured
    if (sendEmail && process.env.RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'Wathefni AI <noreply@careerly.dev>',
            to: [email],
            subject: 'You are invited as an admin',
            html: `<p>You have been invited to administer <strong>${org.rows[0].name}</strong>.</p>
                   <p>Click the link below to accept your invitation:</p>
                   <p><a href="${inviteUrl}">${inviteUrl}</a></p>
                   <p>This link expires in 7 days.</p>`
          }),
        })
        if (!res.ok) throw new Error(`Resend error ${res.status}`)
      } catch (e) {
        console.warn('[INVITE_EMAIL_FAILED]', (e as any)?.message || e)
      }
    }

    console.log(`[INVITE_ADMIN] Success! Invite URL: ${inviteUrl}`)
    return NextResponse.json({ success: true, token, invite_url: inviteUrl })
  } catch (e) {
    console.error('[SUPER_ADMIN_INVITE_ERROR]', (e as any)?.message || e)
    console.error('[SUPER_ADMIN_INVITE_ERROR] Stack:', (e as any)?.stack)
    return NextResponse.json({ 
      error: 'Failed to create invite',
      details: (e as any)?.message 
    }, { status: 500 })
  }
}
