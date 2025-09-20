import { NextResponse } from 'next/server'
import crypto from 'crypto'

// Generate CSRF token for forms
export async function GET() {
  const token = crypto.randomBytes(32).toString('hex')
  
  // In production, you'd store this in a session or Redis
  // For now, we'll use a simple time-based validation
  const timestamp = Date.now()
  const hash = crypto
    .createHash('sha256')
    .update(`${token}-${timestamp}`)
    .digest('hex')
  
  return NextResponse.json({ 
    token: `${token}-${timestamp}-${hash.substring(0, 8)}`
  })
}
