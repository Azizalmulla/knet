import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

// Ensure @vercel/postgres has a connection string in local dev
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET() {
  try {
    const result = await sql`
      SELECT 
        id::text, 
        slug, 
        name, 
        logo_url,
        is_public
      FROM organizations 
      WHERE is_public = true
      ORDER BY name ASC
    `
    
    return NextResponse.json({ 
      organizations: result.rows 
    })
  } catch (error) {
    console.error('Failed to fetch public organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}
