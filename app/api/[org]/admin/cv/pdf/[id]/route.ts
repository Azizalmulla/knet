import { NextResponse, NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { jwtVerify } from '@/lib/esm-compat/jose'
import { sql } from '@vercel/postgres'
import { pdf, Font } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'
import { setReactPdfOverride } from '@/lib/pdf/react-pdf-shim'
import { createCVDocument } from '@/lib/pdf/cv-document'
import { renderMacchiatoPdf } from '@/lib/jsonresume/macchiato'
import { getPresignedUrl } from '@/lib/storage'

export const runtime = 'nodejs'

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

// Register local TTF fonts ONCE per lambda cold start (same pattern as legacy route)
function registerFontSafe(family: string, files: { src: string; fontWeight?: number | 'normal' | 'bold' }[]) {
  try {
    const cwd = process.cwd()
    const okFiles = files
      .map((f) => ({ ...f, src: path.resolve(cwd, f.src) }))
      .filter((f) => fs.existsSync(f.src) && /\.(ttf|otf)$/i.test(f.src))
    if (okFiles.length) {
      Font.register({ family, fonts: okFiles as any })
      const fam = ((Font as any)._knet_families || {}) as Record<string, boolean>
      fam[family] = true
      ;(Font as any)._knet_families = fam
    }
  } catch {
    // swallow errors and let Helvetica fallback
  }
}

try {
  if (!(Font as any)._knet_fs_registered) {
    registerFontSafe('Inter', [
      { src: './public/fonts/Inter-Regular.ttf', fontWeight: 400 },
      { src: './public/fonts/Inter-Bold.ttf', fontWeight: 700 },
    ])
    registerFontSafe('NotoKufiArabic', [
      { src: './public/fonts/NotoKufiArabic-Regular.ttf', fontWeight: 400 },
      { src: './public/fonts/NotoKufiArabic-Bold.ttf', fontWeight: 700 },
    ])
    ;(Font as any)._knet_fs_registered = true
  }
} catch {}

export async function GET(req: NextRequest, { params }: { params: { org: string; id: string } }) {
  const { org, id } = params
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') ?? undefined
  const langParam = searchParams.get('lang') ?? undefined
  const densityParam = searchParams.get('density') === 'compact' ? 'compact' : 'comfortable'

  try {
    // Admin gate (avoid exposing PII)
    const adminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || 'test-admin-key'
    let authorized = false
    // Path 0: middleware already authenticated request (adds x-admin-id)
    const adminIdHeader = req.headers.get('x-admin-id')
    if (adminIdHeader && adminIdHeader.trim()) authorized = true
    // Path 1: explicit token query param
    if (token && token === adminKey) authorized = true
    // Path 2: org-scoped admin session via cookie (JWT)
    if (!authorized) {
      try {
        // Prefer request cookies for Route Handlers
        let session = req.cookies.get('admin_session')?.value
        if (!session) {
          // Fallback to next/headers store (SSR context)
          const cookieStore = cookies()
          session = cookieStore.get('admin_session')?.value
        }
        if (session) {
          const secret = new TextEncoder().encode(JWT_SECRET)
          const { payload } = await jwtVerify(session, secret)
          if ((payload as any)?.orgSlug === org) {
            authorized = true
          }
        }
      } catch {}
    }
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve org and fetch candidate record with strict org scoping
    const orgRes = await sql`SELECT id::uuid as id FROM public.organizations WHERE slug = ${org} LIMIT 1`
    if (!orgRes.rows.length) {
      return NextResponse.json({ error: 'Org not found' }, { status: 404 })
    }
    const orgId = orgRes.rows[0].id as string

    // Fetch candidate (UUID) and associated CV JSON/template
    const q = sql`
      SELECT c.id::uuid AS id, c.cv_json, c.cv_template, COALESCE(c.cv_blob_key,'') AS cv_blob_key, c.cv_type::text AS cv_type
      FROM public.candidates c
      WHERE c.id = ${id}::uuid AND c.org_id = ${orgId}::uuid
      LIMIT 1
    `
    const result = await q
    if (!result?.rows?.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const row = result.rows[0] as any
    const cvType = String((row as any)?.cv_type || '').toLowerCase()
    const cv = (typeof row.cv_json === 'string' ? JSON.parse(row.cv_json) : row.cv_json) || {}
    const template = (row.cv_template as any) || 'professional'
    const language = langParam || cv.language || 'en'

    // Ensure our shim uses the real renderer primitives in this server environment
    try {
      const mod = await import('@react-pdf/renderer')
      setReactPdfOverride(mod as any)
    } catch {}

    // For manually uploaded CVs, skip Macchiato and return the original
    if (cvType !== 'ai_generated') {
      try {
        const key = String((row as any)?.cv_blob_key || '').trim()
        if (key) {
          // For Vercel Blob URLs, redirect directly
          if (/^https:\/\/.*\.public\.blob\.vercel-storage\.com\//i.test(key)) {
            const res = NextResponse.redirect(new URL(key), { status: 302 })
            try { res.headers.set('X-Renderer', 'original') } catch {}
            return res
          }
          // For other storage, presign first
          const { url } = await getPresignedUrl(key, 60)
          if (url) {
            const res = NextResponse.redirect(new URL(url), { status: 302 })
            try { res.headers.set('X-Renderer', 'original') } catch {}
            return res
          }
        }
      } catch {}
      return new Response('Original CV unavailable', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // Macchiato-only export (parity with preview) for AI-generated CVs
    const macchiatoBytes = await renderMacchiatoPdf(cv)
    if (macchiatoBytes) {
      return new Response(macchiatoBytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="CV-${row.id}.pdf"`,
          'Cache-Control': 'no-store',
          'X-Renderer': 'macchiato',
        },
      })
    }
    // Fallback: redirect to original uploaded file if available (supports Vercel Blob or Supabase)
    try {
      const key = String((row as any)?.cv_blob_key || '').trim()
      if (key) {
        // For Vercel Blob URLs, redirect directly
        if (/^https:\/\/.*\.public\.blob\.vercel-storage\.com\//i.test(key)) {
          const res = NextResponse.redirect(new URL(key), { status: 302 })
          try { res.headers.set('X-Renderer', 'original') } catch {}
          return res
        }
        // For other storage, presign first
        const { url } = await getPresignedUrl(key, 60)
        if (url) {
          const res = NextResponse.redirect(new URL(url), { status: 302 })
          try { res.headers.set('X-Renderer', 'original') } catch {}
          return res
        }
      }
    } catch {}
    return new Response('Macchiato renderer unavailable', {
      status: 501,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Renderer': 'unavailable' },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to generate PDF', detail: String(err?.message || err) },
      { status: 500 }
    )
  }
}
