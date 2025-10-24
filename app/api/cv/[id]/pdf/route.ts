import { NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { Font } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'
import { setReactPdfOverride } from '@/lib/pdf/react-pdf-shim'
import { renderMacchiatoPdf } from '@/lib/jsonresume/macchiato'

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
  const densityParam = searchParams.get('density') === 'compact' ? 'compact' : 'comfortable'

  try {
    // Admin gate (avoid exposing PII)
    const adminKey = process.env.ADMIN_KEY || process.env.NEXT_PUBLIC_ADMIN_KEY || 'test-admin-key'
    if (!token || token !== adminKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch candidate record (updated from students table)
    const result = await sql`SELECT id::uuid as id, full_name, email, cv_json, cv_template, cv_type::text as cv_type, cv_blob_key FROM public.candidates WHERE id = ${id}::uuid LIMIT 1`
    if (!result?.rows?.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const row = result.rows[0] as any
    const cv = (typeof row.cv_json === 'string' ? JSON.parse(row.cv_json) : row.cv_json) || {}
    const template = (row.cv_template as any) || 'minimal'
    const language = langParam || cv.language || row.language || 'en'

    // Debug logging for legacy route
    console.log('[LEGACY_PDF_ROUTE] Candidate ID:', id)
    console.log('[LEGACY_PDF_ROUTE] cv_type from DB:', row.cv_type)
    console.log('[LEGACY_PDF_ROUTE] cv_blob_key:', row.cv_blob_key || 'null')
    console.log('[LEGACY_PDF_ROUTE] Has cv_json:', !!cv)

    // Fonts are registered at module load if present under public/fonts

    // Ensure our shim uses the real renderer primitives in this server environment
    try {
      const mod = await import('@react-pdf/renderer')
      setReactPdfOverride(mod as any)
    } catch {}

    // Check if it's an AI-generated CV (flexible matching)
    const cvType = String(row.cv_type || '').toLowerCase()
    const isAIGenerated = ['ai_generated', 'ai', 'ai_builder', 'generated'].includes(cvType)
    console.log('[LEGACY_PDF_ROUTE] cvType normalized:', cvType)
    console.log('[LEGACY_PDF_ROUTE] isAIGenerated:', isAIGenerated)
    
    // Only render Macchiato for AI-generated CVs
    if (!isAIGenerated) {
      return new Response('Original CV unavailable', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    
    // Macchiato-only export
    const macchiatoBytes = await renderMacchiatoPdf(cv)
    if (macchiatoBytes) {
      return new Response(Buffer.from(macchiatoBytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="CV-${row.id}.pdf"`,
          'Cache-Control': 'no-store',
          'X-Renderer': 'macchiato',
        },
      })
    }
    return NextResponse.json({ error: 'Macchiato unavailable' }, { status: 501 })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to generate PDF', detail: String(err?.message || err) },
      { status: 500 }
    )
  }
}
