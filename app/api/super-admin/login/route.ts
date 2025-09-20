import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  
  // Rate limit: 5 attempts per minute
  const rateLimitResult = checkRateLimitWithConfig(request, {
    maxRequests: 5,
    windowMs: 60 * 1000,
    namespace: `super-admin-login-${clientIp}`
  })
  
  if (!rateLimitResult.success) {
    console.log(`[AUDIT] Super admin rate limit exceeded: ${clientIp}`)
    return createRateLimitResponse(rateLimitResult)
  }
  
  try {
    const { email, password } = await request.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      )
    }
    
    // Check environment variable first (for initial setup)
    const envEmail = process.env.SUPER_ADMIN_EMAIL || 'super@careerly.com'
    const envPassword = process.env.SUPER_ADMIN_PASSWORD || 'super123'
    
    let authenticated = false
    let superAdminId = 'env-super-admin'
    let superAdminName = 'Super Admin'
    
    // Try environment credentials first
    if (email === envEmail && password === envPassword) {
      authenticated = true
    } else {
      // Try database
      const result = await sql`
        SELECT id, email, password_hash, name
        FROM super_admins
        WHERE email_lc = ${email.toLowerCase()}
        LIMIT 1
      `
      
      if (result.rows.length > 0) {
        const admin = result.rows[0]
        const valid = await bcrypt.compare(password, admin.password_hash)
        if (valid) {
          authenticated = true
          superAdminId = admin.id
          superAdminName = admin.name || 'Super Admin'
        }
      }
    }
    
    if (!authenticated) {
      console.log(`[AUDIT] Failed super admin login: ${email} - ${clientIp}`)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    // Update last login if using database
    if (superAdminId !== 'env-super-admin') {
      await sql`
        UPDATE super_admins 
        SET last_login = now() 
        WHERE id = ${superAdminId}::uuid
      `
    }
    
    // Create JWT token
    const sessionId = crypto.randomUUID()
    const expiryTime = Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 1 day
    
    const token = jwt.sign(
      {
        sessionId,
        superAdminId,
        email,
        name: superAdminName,
        role: 'super_admin',
        exp: expiryTime
      },
      JWT_SECRET
    )
    
    // Store session if using database
    if (superAdminId !== 'env-super-admin') {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      await sql`
        INSERT INTO super_admin_sessions (super_admin_id, token_hash, ip_address, user_agent, expires_at)
        VALUES (
          ${superAdminId}::uuid,
          ${tokenHash},
          ${clientIp},
          ${request.headers.get('user-agent') || 'unknown'},
          to_timestamp(${expiryTime})
        )
      `
    }
    
    // Set HTTP-only cookie
    const response = NextResponse.json({ 
      success: true,
      admin: {
        id: superAdminId,
        email,
        name: superAdminName
      }
    })
    
    response.cookies.set('super_admin_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 1 day
      path: '/'
    })
    
    console.log(`[AUDIT] Successful super admin login: ${email} - ${clientIp}`)
    
    return response
  } catch (error) {
    console.error('Super admin login error:', error)
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    )
  }
}
