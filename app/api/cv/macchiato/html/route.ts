import { NextRequest } from 'next/server'
import { renderMacchiatoHTMLWithDebug } from '@/lib/jsonresume/macchiato'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const cv = body?.cv || {}
    const theme = body?.theme || 'macchiato' // Support theme selection
    const { html, reason, themeShape } = await renderMacchiatoHTMLWithDebug(cv, theme)
    if (!html) {
      // Surface reason so we can debug in the Network panel on Vercel
      return new Response(`<pre>Theme render failed: ${reason || 'unknown'}</pre>`, {
        status: 501,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Renderer': 'unavailable',
          'X-Reason': reason || 'unknown',
          'X-Theme-Shape': themeShape || 'unknown',
          'X-Theme': theme,
        },
      })
    }
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Renderer': theme,
        'X-Theme-Shape': themeShape || 'unknown',
        'X-Theme': theme,
      }
    })
  } catch (err: any) {
    return new Response(`<pre>Failed to render: ${String(err?.message || err)}</pre>`, { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}
