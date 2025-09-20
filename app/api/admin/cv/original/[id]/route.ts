import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}
import { head } from '@vercel/blob'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params
  const { searchParams } = new URL(req.url)
  const token = (searchParams.get('token') || '').trim()

  // Admin gate
  const adminKey = (process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || 'test-admin-key').trim()
  if (!token || token !== adminKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await sql`
      SELECT c.cv_blob_key
      FROM candidates c
      JOIN organizations o ON o.id = c.org_id
      WHERE c.id = ${id}::uuid AND o.slug = 'careerly' AND c.deleted_at IS NULL
      LIMIT 1
    `
    if (!res?.rows?.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const key = res.rows[0].cv_blob_key as string | null
    if (!key) {
      return NextResponse.json({ error: 'No file' }, { status: 404 })
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'BLOB_NOT_CONFIGURED' }, { status: 500 })
    }

    // Resolve blob info and redirect to its download URL
    const info: any = await head(key, { token: process.env.BLOB_READ_WRITE_TOKEN! })
    const url = info?.downloadUrl || info?.url
    if (!url) {
      return NextResponse.json({ error: 'BLOB_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.redirect(url, { status: 302 })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'BLOB_HEAD_FAILED', message: String(err?.message || err) },
      { status: 502 }
    )
  }
}
