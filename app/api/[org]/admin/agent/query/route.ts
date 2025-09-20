import { NextRequest, NextResponse } from 'next/server'

// Org-scoped proxy to the unified agent endpoint. This keeps logic in one place
// while providing a clean per-org API path. Cookie-based auth and org checks
// are enforced in the target route and middleware.
export async function POST(request: NextRequest, { params }: { params: { org: string } }) {
  const orgSlug = params.org
  const url = new URL(`/api/admin/agent/query?org=${encodeURIComponent(orgSlug)}`, request.nextUrl.origin)
  const bodyText = await request.text()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') || 'application/json',
      // forward cookies for JWT-based auth
      cookie: request.headers.get('cookie') || ''
    },
    body: bodyText
  })

  const data = await res.text()
  return new NextResponse(data, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') || 'application/json' }
  })
}
