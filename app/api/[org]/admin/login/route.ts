import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import crypto from 'crypto'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'
// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  
  // Rate limit login attempts (5 per 15 minutes per IP+email combo)
  const body = await request.json()
  const rateLimitKey = `${clientIp}-${body.email || 'unknown'}`
  
  const rateLimitResult = checkRateLimitWithConfig(request, {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    namespace: `admin-login-${rateLimitKey}`
  })
  if (!rateLimitResult.success) {
    // Log failed attempt
    console.log(`[AUDIT] Rate limit exceeded for admin login: ${orgSlug} - ${body.email} - ${clientIp}`)
    return createRateLimitResponse(rateLimitResult)
  }
  
  try {
    const { email, password, rememberMe } = body
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }
    
    // Get organization
    const orgResult = await sql`
      SELECT id::text FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `
    if (!orgResult.rows.length) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    const orgId = orgResult.rows[0].id
    
    // Find admin user
    const adminResult = await sql`
      SELECT 
        id::text,
        password_hash,
        role,
        email
      FROM admin_users 
      WHERE org_id = ${orgId}::uuid 
        AND email_lc = ${email.toLowerCase()}
      LIMIT 1
    `
    
    if (!adminResult.rows.length) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    const admin = adminResult.rows[0]
    
    // Verify password
    const isValid = await bcrypt.compare(password, admin.password_hash)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    // Update last login
    await sql`
      UPDATE admin_users 
      SET last_login = now() 
      WHERE id = ${admin.id}::uuid
    `
    
    // Create JWT token with session ID for revocation
    const sessionId = crypto.randomUUID()
    // 30 days if remember me, else 8 hours
    const expirySeconds = rememberMe ? (30 * 24 * 60 * 60) : (8 * 60 * 60)
    const expiryTime = Math.floor(Date.now() / 1000) + expirySeconds
    
    const secret = new TextEncoder().encode(JWT_SECRET)
    const token = await new SignJWT({
      sessionId,
      adminId: admin.id,
      orgId: orgId,
      orgSlug: orgSlug,
      email: admin.email,
      role: admin.role,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(expirySeconds + 's')
      .sign(secret)
    
    // Store session in database for tracking
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    await sql`
      INSERT INTO admin_sessions (admin_id, org_id, token_hash, ip_address, user_agent, expires_at)
      VALUES (
        ${admin.id}::uuid,
        ${orgId}::uuid,
        ${tokenHash},
        ${clientIp},
        ${request.headers.get('user-agent') || 'unknown'},
        to_timestamp(${expiryTime})
      )
    `
    
    // Set HTTP-only cookie
    const response = NextResponse.json({ 
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role
      }
    })
    
    response.cookies.set('admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expirySeconds,
      path: '/'
    })
    
    // Log successful login
    console.log(`[AUDIT] Successful admin login: ${orgSlug} - ${admin.email} - ${clientIp}`)
    
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
