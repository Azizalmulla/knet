import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { pdf, Font } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'
import { createCVDocument } from '@/lib/pdf/cv-document'

export const runtime = 'nodejs'

// Register local TTF fonts ONCE per lambda cold start
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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') ?? undefined
  const langParam = searchParams.get('lang') ?? undefined

  try {
    // Admin gate (avoid exposing PII)
    const adminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || 'test-admin-key'
    if (!token || token !== adminKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch student record
    const result = await sql`SELECT id, full_name, email, cv_json, cv_template FROM public.students WHERE id = ${id} LIMIT 1`
    if (!result?.rows?.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const row = result.rows[0] as any
    const cv = (typeof row.cv_json === 'string' ? JSON.parse(row.cv_json) : row.cv_json) || {}
    const template = (row.cv_template as any) || 'minimal'
    const language = langParam || cv.language || row.language || 'en'

    // Fonts are registered at module load if present under public/fonts

    // Render React-PDF document directly (no headless browser)
    const element = createCVDocument(cv, template, language)
    const blob = await pdf(element).toBlob()
    const ab = await blob.arrayBuffer()
    const bytes = new Uint8Array(ab)

    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CV-${row.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to generate PDF', detail: String(err?.message || err) },
      { status: 500 }
    )
  }
}
