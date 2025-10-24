import { NextRequest, NextResponse } from 'next/server'
import { Font } from '@react-pdf/renderer'
import { renderMacchiatoPdf } from '@/lib/jsonresume/macchiato'
import fs from 'fs'
import path from 'path'
import React from 'react'
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
    // Deprecated route: use Macchiato-only to keep parity with preview
    const bytes = await renderMacchiatoPdf(cv)
    if (bytes) {
      const res = new Response(bytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="CV.pdf"',
          'Cache-Control': 'no-store',
          'X-Renderer': 'macchiato',
          'Deprecation': 'true',
          'Sunset': 'Sun, 01 Dec 2025 00:00:00 GMT',
        },
      })
      res.headers.set('Link', '</api/cv/pdf>; rel="successor-version"')
      return res
    }
    return new Response('Deprecated: Macchiato renderer unavailable', {
      status: 410,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Deprecation': 'true' },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate PDF', detail: String(err?.message || err) }, { status: 500 })
  }
}
