import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import jwt from 'jsonwebtoken'

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

export async function PATCH(request: NextRequest, { params }: { params: { orgId: string } }) {
  const admin = verifySuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = params.orgId
  if (!orgId) return NextResponse.json({ error: 'Missing orgId' }, { status: 400 })

  try {
    const body = await request.json() as Partial<{ enable_ai_builder: boolean; enable_exports: boolean; enable_analytics: boolean }>

    const updates: string[] = []
    const values: any[] = []
    let idx = 1

    const allowed: Array<keyof typeof body> = ['enable_ai_builder','enable_exports','enable_analytics']
    for (const key of allowed) {
      if (typeof body[key] === 'boolean') {
        updates.push(`${key} = $${idx}`)
        values.push(body[key])
        idx++
      }
    }
    if (!updates.length) {
      return NextResponse.json({ error: 'No valid feature flags provided' }, { status: 400 })
    }

    const query = `UPDATE organizations SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx}::uuid RETURNING id::text, name, slug, enable_ai_builder, enable_exports, enable_analytics`
    const res = await sql.query(query, [...values, orgId])
    if (!res.rows.length) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

    return NextResponse.json({ success: true, organization: res.rows[0] })
  } catch (e) {
    console.error('[SUPER_ADMIN_FEATURES_ERROR]', (e as any)?.message || e)
    return NextResponse.json({ error: 'Failed to update features' }, { status: 500 })
  }
}
