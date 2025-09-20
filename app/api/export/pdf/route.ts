import { NextRequest, NextResponse } from 'next/server'
import { pdf, Font } from '@react-pdf/renderer'
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
    const template = (body?.template as 'minimal'|'modern'|'creative') || 'minimal'
    const language = (body?.language as string) || 'en'

    const element = createCVDocument(cv, template, language)
    const blob = await pdf(element).toBlob()
    const ab = await blob.arrayBuffer()
    const bytes = new Uint8Array(ab)

    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="CV.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate PDF', detail: String(err?.message || err) }, { status: 500 })
  }
}
