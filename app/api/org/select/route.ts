import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { orgSlug } = await request.json()
    
    if (!orgSlug) {
      return NextResponse.json({ error: 'Organization slug is required' }, { status: 400 })
    }
    
    // Store the selected organization in a cookie
    cookies().set('selected_org', orgSlug, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })
    
    return NextResponse.json({ success: true, orgSlug })
  } catch (error) {
    console.error('Failed to set organization:', error)
    return NextResponse.json({ error: 'Failed to set organization' }, { status: 500 })
  }
}
