import { NextRequest, NextResponse } from 'next/server'
import { Font, pdf } from '@react-pdf/renderer'
import fs from 'fs'
import path from 'path'
import React from 'react'
import { setReactPdfOverride } from '@/lib/pdf/react-pdf-shim'
import { createBrutalistDocument } from '@/lib/pdf/cv-document'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
    // fall back to Helvetica
  }
}

try {
  if (!(Font as any)._knet_fs_registered_brutalist_pdf) {
    registerFontSafe('Inter', [
      { src: './public/fonts/Inter-Regular.ttf', fontWeight: 400 },
      { src: './public/fonts/Inter-Bold.ttf', fontWeight: 700 },
    ])
    registerFontSafe('NotoKufiArabic', [
      { src: './public/fonts/NotoKufiArabic-Regular.ttf', fontWeight: 400 },
      { src: './public/fonts/NotoKufiArabic-Bold.ttf', fontWeight: 700 },
    ])
    ;(Font as any)._knet_fs_registered_brutalist_pdf = true
  }
} catch {}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const cv = body?.cv || {}
    const language = (body?.language as string) || 'en'
    const density: 'comfortable' | 'compact' = body?.density === 'compact' ? 'compact' : 'comfortable'

    // Ensure shim delegates to the real renderer in this environment
    try {
      const mod = await import('@react-pdf/renderer')
      setReactPdfOverride(mod as any)
    } catch {}

    const document = createBrutalistDocument(cv, language, density)
    const instance = pdf(document as any)
    const buffer = await instance.toBuffer()
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as any)

    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="CV-brutalist.pdf"',
        'Cache-Control': 'no-store',
        'X-Renderer': 'react-pdf-brutalist',
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate Brutalist PDF', detail: String(err?.message || err) }, { status: 500 })
  }
}
