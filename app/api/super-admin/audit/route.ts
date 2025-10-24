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

export async function GET(request: NextRequest) {
  const admin = verifySuperAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const qp = (k: string) => (url.searchParams.get(k) || '').trim()
  const action = qp('action')
  const limit = Math.max(1, Math.min(500, parseInt(qp('limit') || '100', 10) || 100))
  const offset = Math.max(0, parseInt(qp('offset') || '0', 10) || 0)
  const from = qp('from')
  const to = qp('to')

  try {
    const conds: string[] = []
    const values: any[] = []
    let p = 1

    if (action) { conds.push(`a.action = $${p++}`); values.push(action) }
    if (from)   { conds.push(`a.timestamp >= $${p++}`); values.push(new Date(from)) }
    if (to)     { conds.push(`a.timestamp <= $${p++}`); values.push(new Date(to)) }

    const whereSQL = conds.length ? `WHERE ${conds.join(' AND ')}` : ''

    const q = `
      SELECT 
        a.timestamp,
        a.action,
        a.payload,
        a.org_id::text as org_id,
        COALESCE(o.slug, '') AS org_slug
      FROM super_admin_audit a
      LEFT JOIN organizations o ON o.id = a.org_id
      ${whereSQL}
      ORDER BY a.timestamp DESC
      OFFSET $${p}
      LIMIT $${p+1}
    `

    const res = await sql.query(q, [...values, offset, limit])
    return NextResponse.json({ events: res.rows })
  } catch (e) {
    console.error('[SUPER_ADMIN_AUDIT_GET_ERROR]', (e as any)?.message || e)
    return NextResponse.json({ error: 'Failed to fetch audit' }, { status: 500 })
  }
}
