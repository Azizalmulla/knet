import { NextRequest, NextResponse } from 'next/server'
import { pdf, Font } from '@react-pdf/renderer'
import { setReactPdfOverride } from '@/lib/pdf/react-pdf-shim'
import fs from 'fs'
import path from 'path'
import React from 'react'
import { createCVDocument } from '@/lib/pdf/cv-document'
import { renderMacchiatoPdf } from '@/lib/jsonresume/macchiato'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  if (!(Font as any)._knet_fs_registered_public_pdf) {
    registerFontSafe('Inter', [
      { src: './public/fonts/Inter-Regular.ttf', fontWeight: 400 },
      { src: './public/fonts/Inter-Bold.ttf', fontWeight: 700 },
    ])
    registerFontSafe('NotoKufiArabic', [
      { src: './public/fonts/NotoKufiArabic-Regular.ttf', fontWeight: 400 },
      { src: './public/fonts/NotoKufiArabic-Bold.ttf', fontWeight: 700 },
    ])
    ;(Font as any)._knet_fs_registered_public_pdf = true
  }
} catch {}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const cv = body?.cv || {}
    const template = (body?.template as any) || 'professional'
    const language = (body?.language as string) || 'en'
    const density = body?.density === 'compact' ? 'compact' : 'comfortable'

    // Ensure our shim uses the real renderer primitives in this server environment
    try {
      const mod = await import('@react-pdf/renderer')
      setReactPdfOverride(mod as any)
    } catch {}

    // Render Macchiato (must match preview); no fallback
    const macchiatoBytes = await renderMacchiatoPdf(cv)
    if (macchiatoBytes) {
      return new Response(new Blob([macchiatoBytes as BlobPart], { type: 'application/pdf' }), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="CV.pdf"',
          'Cache-Control': 'no-store',
          'X-Renderer': 'macchiato',
        },
      })
    }
    return new Response('Macchiato renderer unavailable', {
      status: 501,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Renderer': 'unavailable' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate PDF', detail: String(err?.message || err) }, { status: 500 })
  }
}
