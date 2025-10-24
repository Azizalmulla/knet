import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import crypto from 'crypto'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

async function getOrgBySlug(slug: string) {
  const res = await sql`SELECT id::text, slug, name FROM organizations WHERE slug = ${slug} LIMIT 1`
  return res.rows[0] as { id: string; slug: string; name: string } | undefined
}

async function getAdminUsersOrgColumn(): Promise<'organization_id' | 'org_id'> {
  try {
    const res = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users'
        AND column_name IN ('organization_id','org_id')
    `
    const cols = res.rows.map(r => (r as any).column_name as string)
    return cols.includes('organization_id') ? 'organization_id' : 'org_id'
  } catch {
    return 'organization_id'
  }
}

async function getAdminSessionsOrgColumn(): Promise<'organization_id' | 'org_id'> {
  try {
    const res = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_sessions'
        AND column_name IN ('organization_id','org_id')
    `
    const cols = res.rows.map(r => (r as any).column_name as string)
    return cols.includes('organization_id') ? 'organization_id' : 'org_id'
  } catch {
    return 'organization_id'
  }
}

export async function GET(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  const { searchParams } = new URL(request.url)
  const token = (searchParams.get('token') || '').trim()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    const org = await getOrgBySlug(orgSlug)
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    const invite = await sql`
      SELECT email, role, expires_at, accepted_at
      FROM admin_invites
      WHERE token = ${token} AND organization_id = ${org.id}::uuid
      LIMIT 1
    `
    if (!invite.rows.length) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    const row = invite.rows[0] as { email: string; role: string; expires_at: string; accepted_at: string | null }

    if (row.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 })
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, email: row.email, role: row.role })
  } catch (e) {
    console.error('[ACCEPT_INVITE_GET_ERROR]', (e as any)?.message || e)
    return NextResponse.json({ error: 'Failed to verify invite' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

  try {
    const { token, password } = await request.json()
    const pw = String(password || '')
    const tok = String(token || '')
    if (!tok || pw.length < 8) {
      return NextResponse.json({ error: 'Invalid token or password too short' }, { status: 400 })
    }

    const org = await getOrgBySlug(orgSlug)
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    const inviteRes = await sql`
      SELECT id::uuid as id, email, role, expires_at, accepted_at
      FROM admin_invites
      WHERE token = ${tok} AND organization_id = ${org.id}::uuid
      LIMIT 1
    `
    if (!inviteRes.rows.length) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    const invite = inviteRes.rows[0] as { id: string; email: string; role: 'owner'|'admin'|'viewer'; expires_at: string; accepted_at: string | null }

    if (invite.accepted_at) return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 })
    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(pw, 12)
    const emailLc = invite.email.toLowerCase()

    // Upsert admin user for this organization (support legacy org_id)
    const adminUsersOrgCol = await getAdminUsersOrgColumn()
    const upsertSql = `
      INSERT INTO admin_users (${adminUsersOrgCol}, email, password_hash, role, invite_token)
      VALUES ($1::uuid, $2, $3, $4, $5)
      ON CONFLICT (${adminUsersOrgCol}, email_lc) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
    `
    await sql.query(upsertSql, [org.id, invite.email, password_hash, invite.role, tok])

    // Mark invite accepted
    await sql`UPDATE admin_invites SET accepted_at = now() WHERE id = ${invite.id}::uuid`

    // Create admin session cookie (same format as login)
    const sessionId = crypto.randomUUID()
    const expirySeconds = 8 * 60 * 60 // 8 hours
    const expiryTime = Math.floor(Date.now() / 1000) + expirySeconds

    const secret = new TextEncoder().encode(JWT_SECRET)
    const tokenJwt = await new SignJWT({
      sessionId,
      orgId: org.id,
      orgSlug: org.slug,
      email: invite.email,
      role: invite.role,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(expirySeconds + 's')
      .sign(secret)

    const tokenHash = crypto.createHash('sha256').update(tokenJwt).digest('hex')
    const adminSessionsOrgCol = await getAdminSessionsOrgColumn()
    const insertSessionSql = `
      INSERT INTO admin_sessions (admin_id, ${adminSessionsOrgCol}, token_hash, ip_address, user_agent, expires_at)
      SELECT u.id::uuid, $1::uuid, $2, $3, $4, to_timestamp($5)
      FROM admin_users u
      WHERE u.${adminUsersOrgCol} = $1::uuid AND u.email_lc = $6
      LIMIT 1
    `
    await sql.query(insertSessionSql, [org.id, tokenHash, clientIp, request.headers.get('user-agent') || 'unknown', expiryTime, emailLc])

    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_session', tokenJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expirySeconds,
      path: '/',
    })

    return response
  } catch (e) {
    console.error('[ACCEPT_INVITE_POST_ERROR]', (e as any)?.message || e)
    return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 })
  }
}
