import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import jwt from 'jsonwebtoken'

// Ensure @vercel/postgres uses the same connection as other routes
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

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

// DELETE /api/super-admin/organizations/[orgId]?mode=soft
export async function DELETE(request: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = verifySuperAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = params.orgId
  if (!orgId) {
    return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })
  }

  const url = new URL(request.url)
  const mode = (url.searchParams.get('mode') || 'soft').toLowerCase()

  if (mode !== 'soft') {
    // Hard delete is intentionally not supported to avoid FK issues/data loss
    return NextResponse.json({ error: 'Only soft delete is supported' }, { status: 400 })
  }

  try {
    const existing = await sql`
      SELECT id::text, slug, name FROM organizations WHERE id = ${orgId}::uuid LIMIT 1
    `
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const org = existing.rows[0] as { id: string; slug: string; name: string }

    // Generate an archived slug to free original slug namespace and hide from pickers
    const base = `deleted-${org.slug}`
    let candidate = `${base}-${Date.now().toString(36)}`

    // Ensure uniqueness (2 extra attempts should be enough in practice)
    for (let i = 0; i < 2; i++) {
      const dupe = await sql`SELECT 1 FROM organizations WHERE slug = ${candidate} LIMIT 1`
      if (dupe.rows.length === 0) break
      candidate = `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    }

    const updated = await sql`
      UPDATE organizations
      SET
        is_public = false,
        company_code = NULL,
        enable_ai_builder = false,
        enable_exports = false,
        enable_analytics = false,
        slug = ${candidate},
        updated_at = now()
      WHERE id = ${orgId}::uuid
      RETURNING id::text, name, slug, is_public
    `

    // Audit log
    try {
      await sql`
        INSERT INTO super_admin_audit (super_admin_id, org_id, action, payload)
        VALUES (
          ${admin.superAdminId !== 'env-super-admin' ? admin.superAdminId : null}::uuid,
          ${orgId}::uuid,
          'delete_org_soft',
          ${JSON.stringify({ prevSlug: org.slug, newSlug: updated.rows[0]?.slug })}::jsonb
        )
      `
    } catch {}

    return NextResponse.json({ success: true, organization: updated.rows[0] })
  } catch (e) {
    console.error('[SUPER_ADMIN_ORG_DELETE_ERROR]', (e as any)?.message || e)
    return NextResponse.json({ error: 'Failed to delete organization' }, { status: 500 })
  }
}
