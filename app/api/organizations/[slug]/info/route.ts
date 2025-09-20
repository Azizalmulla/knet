import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params
  
  try {
    const result = await sql`
      SELECT 
        name,
        logo_url,
        is_public
      FROM organizations 
      WHERE slug = ${slug}
      LIMIT 1
    `
    
    if (!result.rows.length) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }
    
    const org = result.rows[0]
    
    return NextResponse.json({
      name: org.name,
      logo: org.logo_url,
      isPublic: org.is_public
    })
  } catch (error) {
    console.error('Failed to fetch org info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}
