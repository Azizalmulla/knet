import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
// Ensure @vercel/postgres has a connection string in local dev
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  // Rate limit verification attempts
  const rateLimitResult = checkRateLimit(request)
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult)
  }
  
  try {
    const { code } = await request.json()
    
    if (!code || code.length < 6) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      )
    }
    
    const result = await sql`
      SELECT slug 
      FROM organizations 
      WHERE company_code = ${code.toUpperCase()}
      LIMIT 1
    `
    
    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Invalid company code' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ 
      slug: result.rows[0].slug 
    })
  } catch (error) {
    console.error('Failed to verify company code:', error)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    )
  }
}
