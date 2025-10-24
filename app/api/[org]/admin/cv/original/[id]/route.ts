import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import jwt from 'jsonwebtoken'
import { getPresignedUrl } from '@/lib/storage'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: { org: string; id: string } }) {
  const { org: orgSlug, id } = params

  // Cookie-based admin gate
  const token = req.cookies.get('admin_session')?.value
  const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let decoded: any
  try {
    decoded = jwt.verify(token, JWT_SECRET)
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Verify org matches
    const orgRes = await sql`SELECT id::text FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) return NextResponse.json({ error: 'Org not found' }, { status: 404 })
    const orgId = orgRes.rows[0].id as string
    if (decoded?.orgId !== orgId) return NextResponse.json({ error: 'Unauthorized org' }, { status: 401 })

    // Lookup blob key for candidate under this org
    const res = await sql`
      SELECT c.cv_blob_key
      FROM candidates c
      WHERE c.id = ${id}::uuid AND c.org_id = ${orgId}::uuid AND c.deleted_at IS NULL
      LIMIT 1
    `
    if (!res?.rows?.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const key = res.rows[0].cv_blob_key as string | null
    if (!key) return NextResponse.json({ error: 'No file' }, { status: 404 })

    // Presign URL using whichever storage provider is configured
    try {
      const { url } = await getPresignedUrl(key, 60)
      if (!url) return NextResponse.json({ error: 'PRESIGN_FAILED' }, { status: 502 })
      return NextResponse.redirect(url, { status: 302 })
    } catch (e: any) {
      return NextResponse.json({ error: 'PRESIGN_FAILED', message: String(e?.message || e) }, { status: 502 })
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: 'BLOB_HEAD_FAILED', message: String(err?.message || err) },
      { status: 502 }
    )
  }
}
