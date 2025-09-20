import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get('super_admin_session')?.value
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const decoded = jwt.verify(session, JWT_SECRET) as any
    
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: 'Invalid role' }, { status: 403 })
    }
    
    return NextResponse.json({ 
      authenticated: true,
      admin: {
        id: decoded.superAdminId,
        email: decoded.email,
        name: decoded.name
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }
}
