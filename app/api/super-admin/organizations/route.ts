import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import jwt from 'jsonwebtoken'

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
  const admin = verifySuperAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const result = await sql`
      SELECT 
        o.id::text,
        o.name,
        o.slug,
        o.is_public,
        o.company_code,
        o.logo_url,
        o.enable_ai_builder,
        o.enable_exports,
        o.enable_analytics,
        o.created_at,
        COUNT(DISTINCT au.id) as admin_count
      FROM organizations o
      LEFT JOIN admin_users au ON au.organization_id = o.id
      WHERE o.deleted_at IS NULL
      GROUP BY o.id
      ORDER BY o.created_at DESC
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
    const { name, slug, is_public, company_code, logo_url, domains } = await request.json()
    
    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ 
        error: 'Invalid slug format. Use lowercase letters, numbers, and hyphens only.' 
      }, { status: 400 })
    }
    
    // Check if slug already exists
    const existing = await sql`
      SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
    `
    
    if (existing.rows.length > 0) {
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
