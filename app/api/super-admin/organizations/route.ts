import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import jwt from 'jsonwebtoken'

// Ensure @vercel/postgres uses the same connection as other routes
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

// Verify super admin middleware
function verifySuperAdmin(request: NextRequest) {
  const session = request.cookies.get('super_admin_session')?.value
  if (!session) return null
  
  try {
    const decoded = jwt.verify(session, JWT_SECRET) as any
    if (decoded.role !== 'super_admin') return null
    return decoded
  } catch {
    return null
  }
}

// GET /api/super-admin/organizations
export async function GET(request: NextRequest) {
  // Trust header injected by middleware for allowlisted emails
  const isSuperHeader = (request.headers.get('x-superadmin') || '').toLowerCase() === 'true'
  if (!isSuperHeader) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  try {
    const result = await sql`
      WITH cols AS (
        SELECT 
          EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'is_public'
          ) AS has_is_public,
          EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'company_code'
          ) AS has_company_code,
          EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'logo_url'
          ) AS has_logo_url
      )
      SELECT 
        o.id::text,
        o.name,
        o.slug,
        CASE WHEN c.has_is_public THEN COALESCE(o.is_public, true) ELSE true END AS is_public,
        CASE WHEN c.has_company_code THEN o.company_code ELSE NULL END AS company_code,
        CASE WHEN c.has_logo_url THEN o.logo_url ELSE NULL END AS logo_url,
        0 as admin_count
      FROM organizations o
      CROSS JOIN cols c
      ORDER BY o.name ASC NULLS LAST
    `
    
    return NextResponse.json({ 
      organizations: result.rows 
    })
  } catch (error) {
    console.error('Failed to fetch organizations:', error)
    return NextResponse.json({ error: 'Failed to fetch organizations' }, { status: 500 })
  }
}

// POST /api/super-admin/organizations
export async function POST(request: NextRequest) {
  const admin = verifySuperAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await request.json()
    const { name, slug, is_public, company_code, logo_url, domains } = body
    
    console.log('[CREATE ORG] Request body:', { name, slug, is_public, company_code, logo_url, domains })
    
    // Validate required fields
    if (!name || !slug) {
      console.error('[CREATE ORG] Missing required fields:', { name, slug })
      return NextResponse.json({ 
        error: 'Name and slug are required.' 
      }, { status: 400 })
    }
    
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      console.error('[CREATE ORG] Invalid slug format:', slug)
      return NextResponse.json({ 
        error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.' 
      }, { status: 400 })
    }
    
    // Check if slug already exists
    const existing = await sql`
      SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
    `
    
    if (existing.rows.length > 0) {
      console.error('[CREATE ORG] Slug already exists:', slug)
      return NextResponse.json({ 
        error: 'Organization with this slug already exists' 
      }, { status: 400 })
    }
    
    // Create organization
    const result = await sql`
      INSERT INTO organizations (
        name, 
        slug, 
        is_public, 
        company_code, 
        logo_url,
        domains,
        enable_ai_builder,
        enable_exports,
        enable_analytics
      )
      VALUES (
        ${name},
        ${slug},
        ${is_public || true},
        ${company_code || null},
        ${logo_url || null},
        ${domains ? JSON.stringify(domains) : '[]'}::jsonb,
        true,
        true,
        true
      )
      RETURNING id::text, name, slug, is_public, company_code
    `
    
    const org = result.rows[0]
    
    // Log audit
    await sql`
      INSERT INTO super_admin_audit (super_admin_id, org_id, action, payload)
      VALUES (
        ${admin.superAdminId !== 'env-super-admin' ? admin.superAdminId : null}::uuid,
        ${org.id}::uuid,
        'create_org',
        ${JSON.stringify({ name, slug })}::jsonb
      )
    `
    
    return NextResponse.json({ 
      success: true,
      organization: org,
      links: {
        student: `/${slug}/start`,
        admin: `/${slug}/admin/login`
      }
    })
  } catch (error) {
    console.error('Failed to create organization:', error)
    return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 })
  }
}
