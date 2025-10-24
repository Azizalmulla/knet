import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import crypto from 'crypto'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

export const runtime = 'nodejs'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

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

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  let body: { email?: string; password?: string; rememberMe?: boolean }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = (body.email || '').trim()
  const password = (body.password || '').trim()
  const rememberMe = Boolean(body.rememberMe)

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  // Rate limit per IP+email combo
  const rateLimitKey = `${clientIp}-${email || 'unknown'}`
  const rateLimitResult = checkRateLimitWithConfig(request, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    namespace: `admin-login-global-${rateLimitKey}`
  })
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }

  try {
    // Find admin(s) across all organizations for this email
    const adminUsersOrgCol = await getAdminUsersOrgColumn()
    const query = `
      SELECT 
        au.id::text            AS admin_id,
        au.password_hash       AS password_hash,
        au.role                AS role,
        au.email               AS admin_email,
        org.id::text           AS org_id,
        org.slug               AS org_slug,
        org.name               AS org_name
      FROM admin_users au
      JOIN organizations org ON au.${adminUsersOrgCol} = org.id
      WHERE au.email_lc = $1
      LIMIT 25
    `
    const result = await sql.query(query, [email.toLowerCase()])

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    // Validate password for each potential admin
    const candidates = await Promise.all(
      result.rows.map(async (row) => {
        const isValid = await bcrypt.compare(password, row.password_hash)
        return isValid ? row : null
      })
    )

    const matches = candidates.filter(Boolean) as typeof result.rows

    if (matches.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    if (matches.length > 1) {
      // Ask client to choose the organization
      const orgs = matches.map((m) => ({ slug: m.org_slug as string, name: m.org_name as string }))
      return NextResponse.json({ requiresOrgSelection: true, orgs }, { status: 200 })
    }

    const match = matches[0]

    // Single match: issue org-scoped session JWT
    const sessionId = crypto.randomUUID()
    const expirySeconds = rememberMe ? (30 * 24 * 60 * 60) : (8 * 60 * 60) // 30 days or 8 hours
    const expiryTime = Math.floor(Date.now() / 1000) + expirySeconds

    const secret = new TextEncoder().encode(JWT_SECRET)
    const token = await new SignJWT({
      sessionId,
      adminId: match.admin_id,
      orgId: match.org_id,
      orgSlug: match.org_slug,
      email: match.admin_email,
      role: match.role,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(expirySeconds + 's')
      .sign(secret)

    // Persist session
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const adminSessionsOrgCol = await getAdminSessionsOrgColumn()
    const insertSessionSql = `
      INSERT INTO admin_sessions (admin_id, ${adminSessionsOrgCol}, token_hash, ip_address, user_agent, expires_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, to_timestamp($6))
    `
    await sql.query(insertSessionSql, [match.admin_id, match.org_id, tokenHash, clientIp, (request.headers.get('user-agent') || 'unknown'), expiryTime])

    // Update last login
    await sql`UPDATE admin_users SET last_login = now() WHERE id = ${match.admin_id}::uuid`

    // Best-effort audit log
    try {
      await sql`
        INSERT INTO admin_activity (admin_id, organization_id, action, metadata)
        VALUES (
          ${match.admin_id}::uuid,
          ${match.org_id}::uuid,
          'admin_login_success',
          jsonb_build_object(
            'admin_email', ${match.admin_email},
            'ip', ${clientIp},
            'user_agent', ${request.headers.get('user-agent') || 'unknown'}
          )
        )
      `
    } catch (e) {
      console.warn('[ADMIN_ACTIVITY_LOGIN_INSERT_FAILED]', (e as any)?.message || e)
    }

    const response = NextResponse.json({ success: true, orgSlug: match.org_slug })
    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expirySeconds,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Global admin login error:', error)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
