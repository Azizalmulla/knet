import { NextResponse } from 'next/server'
import { sql, getDbInfo } from '@/lib/db'

// Ensure @vercel/postgres has a connection string in local dev
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export async function GET() {
  try {
    // Debug: Get all orgs first
    const allOrgs = await sql`
      SELECT slug, is_public, deleted_at 
      FROM organizations
      ORDER BY created_at DESC
      LIMIT 10
    `
    console.log('[PUBLIC ORGS] All recent orgs:', allOrgs.rows)
    
    const result = await sql`
      SELECT 
        id::text, 
        slug, 
        name, 
        logo_url,
        is_public
      FROM organizations 
      WHERE is_public = true
        AND deleted_at IS NULL
      ORDER BY name ASC
    `
    
    console.log(`[PUBLIC ORGS] Returning ${result.rows.length} public orgs:`, result.rows.map(r => r.slug))
    
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ organizations: result.rows }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-List-Count': String(result.rows.length) } })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    return res
  } catch (error) {
    console.error('Failed to fetch public organizations:', error)
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate', 'X-List-Count': '0' } })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    return res
  }
}
