import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}
import { jwtVerify } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production'

async function resolveOrganization(slug: string): Promise<{ id: string; slug: string } | null> {
  try {
    const result = await sql`
      SELECT id::text, slug FROM organizations WHERE slug = ${slug} LIMIT 1
    `
    return result.rows[0] as { id: string; slug: string } || null
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Handle super admin routes
  if (pathname.startsWith('/super-admin')) {
    // Skip login page
    if (pathname === '/super-admin/login') {
      return NextResponse.next()
    }
    
    // Check super admin authentication
    const superAdminSession = req.cookies.get('super_admin_session')?.value
    if (!superAdminSession) {
      const url = req.nextUrl.clone()
      url.pathname = '/super-admin/login'
      return NextResponse.redirect(url)
    }
    
    try {
      const secret = new TextEncoder().encode(JWT_SECRET)
      const { payload: decoded } = await jwtVerify(superAdminSession, secret)
      if ((decoded as any).role !== 'super_admin') {
        const url = req.nextUrl.clone()
        url.pathname = '/super-admin/login'
        return NextResponse.redirect(url)
      }
    } catch {
      const url = req.nextUrl.clone()
      url.pathname = '/super-admin/login'
      return NextResponse.redirect(url)
    }
    
    return NextResponse.next()
  }

  // Extract org from path like /careerly/start or /careerly/admin
  // Also support API pattern: /api/:org/admin/...
  const orgMatch = pathname.match(/^\/([^\/]+)\/(start|admin)/)
  const apiOrgMatch = pathname.match(/^\/api\/([^\/]+)\/admin/)
  if (orgMatch || apiOrgMatch) {
    const orgSlug = (orgMatch ? orgMatch[1] : (apiOrgMatch as RegExpMatchArray)[1])
    const isAdminRoute = pathname.includes('/admin')
    
    // Skip public auth pages from auth check (both page and API variants)
    const isAuthPublicPage = (
      pathname.endsWith('/admin/login') ||
      pathname.endsWith('/admin/forgot') ||
      pathname.endsWith('/admin/reset') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/login') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/forgot') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/reset') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/logout')
    )
    
    // Resolve org from DB
    const org = await resolveOrganization(orgSlug)
    if (!org) {
      // Organization not found, return 404
      return new NextResponse('Organization not found', { status: 404 })
    }
    
    // Add org info to headers for downstream consumption
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-org-id', org.id)
    requestHeaders.set('x-org-slug', org.slug)
    
    // Check admin authentication for admin routes (except public auth pages)
    if (isAdminRoute && !isAuthPublicPage) {
      const isApi = pathname.startsWith('/api/')
      const adminSession = req.cookies.get('admin_session')?.value
      try { console.log(`[DEBUG] /${orgSlug}/admin middleware: cookie present=${!!adminSession} len=${adminSession?.length || 0}`) } catch {}
      const unauthorized = () => isApi
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : (() => { const url = req.nextUrl.clone(); url.pathname = `/${orgSlug}/admin/login`; return NextResponse.redirect(url) })()

      if (!adminSession) {
        return unauthorized()
      }
      
      try {
        const secret = new TextEncoder().encode(JWT_SECRET)
        const { payload: decoded } = await jwtVerify(adminSession, secret)
        
        // Verify org matches (CRITICAL: prevent cross-org access)
        if ((decoded as any).orgId !== org.id) {
          console.log(`[SECURITY] Cross-org access attempt: ${decoded.orgSlug} trying to access ${orgSlug}`)
          return unauthorized()
        }
        
        // Check if session is expired
        if ((decoded as any).exp && (decoded as any).exp * 1000 < Date.now()) {
          console.log(`[AUDIT] Session expired for admin: ${(decoded as any).email}`)
          return unauthorized()
        }
        
        // Add admin info to headers for API routes
        requestHeaders.set('x-admin-id', String((decoded as any).adminId))
        requestHeaders.set('x-admin-role', String((decoded as any).role))
        requestHeaders.set('x-admin-email', String((decoded as any).email))
      } catch (error: any) {
        // Invalid token
        console.log(`[SECURITY] Invalid admin token for ${orgSlug} - ${String(error?.message || error)}`)
        return unauthorized()
      }
    }
    
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })
  }

  // Allow these paths through unchanged (including student routes and NextAuth)
  if (
    pathname.startsWith('/api/auth') ||  // NextAuth routes
    pathname.startsWith('/student') ||    // Student auth routes
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/careerly') ||
    pathname.startsWith('/admin') ||
    pathname === '/favicon.ico' ||
    pathname === '/opengraph-image.png' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next()
  }

  // First-time visitors to root get the Careerly landing
  if (pathname === '/') {
    const seen = req.cookies.get('seenCareerlyLanding')?.value
    if (!seen) {
      const url = req.nextUrl.clone()
      url.pathname = '/careerly'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/super-admin',
    '/super-admin/:path*',
    '/:org/start',
    '/:org/admin',
    '/:org/admin/:path*',
    '/api/:org/admin/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
