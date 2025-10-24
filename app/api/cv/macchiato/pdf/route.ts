import { NextRequest, NextResponse } from 'next/server'
import { renderMacchiatoPdfWithDebug } from '@/lib/jsonresume/macchiato'
// Macchiato-only export

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const cv = body?.cv || {}
    const theme = body?.theme || 'macchiato' // Support theme selection

    // Try selected theme (debug-enabled)
    const { bytes, reason } = await renderMacchiatoPdfWithDebug(cv, theme)
    if (bytes) {
      return new Response(bytes, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="CV.pdf"',
          'Cache-Control': 'no-store',
          'X-Renderer': theme,
        },
      })
    }
    // Surface reason in header to ease diagnosis in Network panel
    const headers = new Headers({ 'Content-Type': 'application/json', 'X-Renderer': 'unavailable' })
    if (reason) headers.set('X-Reason', reason)
    return new Response(JSON.stringify({ error: `Theme ${theme} unavailable`, reason: reason || 'unknown' }), { status: 501, headers })
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to generate PDF', detail: String(err?.message || err) }, { status: 500 })
  }
}
