import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function POST(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  let body: any = {}
  try { body = await request.json() } catch {}

  const token = (body?.token || '').toString().trim()
  const password = (body?.password || '').toString()

  // Rate limit: 5 per 15m per IP
  const rl = checkRateLimitWithConfig(request, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    namespace: `admin-reset`
  })
  if (!rl.success) return createRateLimitResponse(rl)

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const orgRes = await sql`SELECT id::text FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    const orgId = orgRes.rows[0].id

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // Find a valid reset
    const resetRes = await sql`
      SELECT id::text, admin_id::text, expires_at, used_at
      FROM admin_password_resets
      WHERE org_id = ${orgId}::uuid AND token_hash = ${tokenHash}
      LIMIT 1
    `
    if (!resetRes.rows.length) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })

    const reset = resetRes.rows[0] as { id: string; admin_id: string; expires_at: string; used_at: string | null }
    if (reset.used_at) return NextResponse.json({ error: 'Token already used' }, { status: 400 })
    if (new Date(reset.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Token expired' }, { status: 400 })

    // Update password (bcrypt 12)
    const hash = await bcrypt.hash(password, 12)
    await sql`
      UPDATE admin_users SET password_hash = ${hash}
      WHERE id = ${reset.admin_id}::uuid AND org_id = ${orgId}::uuid
    `

    // Mark token used
    await sql`
      UPDATE admin_password_resets SET used_at = now() WHERE id = ${reset.id}::uuid
    `

    // Optional: revoke existing sessions for this admin
    await sql`
      DELETE FROM admin_sessions WHERE admin_id = ${reset.admin_id}::uuid
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 })
  }
}
