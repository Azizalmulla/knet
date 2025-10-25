import { NextRequest, NextResponse } from 'next/server'

// Increase timeout for proxy route to match inner handler
export const maxDuration = 60;

// Org-scoped proxy to the unified agent endpoint. This keeps logic in one place
// while providing a clean per-org API path. Cookie-based auth and org checks
// are enforced in the target route and middleware.
export async function POST(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  const url = new URL(`/api/admin/agent/query?org=${encodeURIComponent(orgSlug)}`, request.nextUrl.origin)
  const bodyText = await request.text()

  // Forward important auth headers
  const adminKey = request.headers.get('x-admin-key') || ''
  const adminEmail = request.headers.get('x-admin-email') || ''
  const adminId = request.headers.get('x-admin-id') || ''

  // Add an explicit timeout to avoid hanging and causing browser network errors
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000) // 30s

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': request.headers.get('content-type') || 'application/json',
        // forward cookies for JWT-based auth
        cookie: request.headers.get('cookie') || '',
        // forward legacy header auth as well
        'x-admin-key': adminKey,
        'x-admin-email': adminEmail,
        'x-admin-id': adminId,
      },
      body: bodyText,
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' }
    })
  } catch (err: any) {
    clearTimeout(timeout)
    const msg = String(err?.message || 'Proxy error')
    const isAbort = msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')
    return NextResponse.json(
      {
        error: isAbort ? 'Upstream request timed out' : 'Upstream request failed',
        details: msg,
      },
      { status: isAbort ? 504 : 502 }
    )
  }
}
