import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest, { params }: { params: { org: string } }) {
  const response = NextResponse.json({ success: true })
  try {
    const token = request.cookies.get('admin_session')?.value
    if (token) {
      // Hash token to match stored session
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      // Optional verify to extract admin/org
      let adminId: string | null = null
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any
        adminId = decoded?.adminId as string | null
      } catch {}
      if (adminId) {
        await sql`DELETE FROM admin_sessions WHERE admin_id = ${adminId}::uuid AND token_hash = ${tokenHash}`
      } else {
        await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`
      }
    }
  } catch (e) {
    // Best-effort; still clear cookie below
    console.error('Logout cleanup failed', e)
  }
  
  // Clear the admin session cookie
  response.cookies.set('admin_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })
  
  return response
}
