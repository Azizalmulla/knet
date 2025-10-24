import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import jwt from 'jsonwebtoken'

if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

async function getAdminUsersOrgColumn(): Promise<'organization_id' | 'org_id'> {
  try {
    const res = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'admin_users' 
        AND column_name IN ('organization_id','org_id')
    `
    const cols = res.rows.map(r => (r as any).column_name as string)
    return cols.includes('organization_id') ? 'organization_id' : 'org_id'
  } catch {
    return 'organization_id'
  }
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

function verifySuperAdmin(request: NextRequest) {
  const session = request.cookies.get('super_admin_session')?.value
  if (!session) return null
  try {
    const decoded = jwt.verify(session, JWT_SECRET) as any
    if ((decoded as any).role !== 'super_admin') return null
    return decoded as { superAdminId?: string }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = verifySuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = params.orgId
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  try {
    const col = await getAdminUsersOrgColumn()
    console.log(`[LIST_ADMINS] Fetching admins for org ${orgId} using column ${col}`)
    
    // Use template literal query instead of sql.query
    const res = col === 'organization_id'
      ? await sql`SELECT id::text, email, role, created_at, last_login FROM admin_users WHERE organization_id = ${orgId}::uuid ORDER BY created_at DESC`
      : await sql`SELECT id::text, email, role, created_at, last_login FROM admin_users WHERE org_id = ${orgId}::uuid ORDER BY created_at DESC`
    
    console.log(`[LIST_ADMINS] Found ${res.rows.length} admins`)
    return NextResponse.json({ admins: res.rows })
  } catch (e) {
    console.error('[SUPER_ADMIN_LIST_ADMINS_ERROR]', (e as any)?.message || e)
    return NextResponse.json({ error: 'Failed to list admins', details: (e as any)?.message }, { status: 500 })
  }
}
