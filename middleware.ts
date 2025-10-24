import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}
import { jwtVerify } from '@/lib/esm-compat/jose'

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

  // Early allow: all API routes except the org-scoped admin API and super-admin API should pass through
  // e.g. /api/admin/migrate, /api/telemetry, /api/student/*, etc.
  // NOTE: We must NOT early-return for /api/super-admin so we can inject x-superadmin headers below.
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/super-admin')) {
    const adminApiOrgMatch = pathname.match(/^\/api\/([^\/]+)\/admin/)
    // If not an org-scoped admin API (/api/:org/admin/*), let it pass
    if (!adminApiOrgMatch) {
      return NextResponse.next()
    }
  }

  // Inject x-superadmin for API routes when email is allowlisted
  if (pathname.startsWith('/api/super-admin')) {
    const requestHeaders = new Headers(req.headers)
    try {
      const superAdminSession = req.cookies.get('super_admin_session')?.value
      if (superAdminSession) {
        const secret = new TextEncoder().encode(JWT_SECRET)
        const { payload } = await jwtVerify(superAdminSession, secret)
        const email = String((payload as any)?.email || '').toLowerCase().trim()
        const allowEmails = (process.env.SUPERADMIN_EMAILS || '').split(',').map(s => s.toLowerCase().trim()).filter(Boolean)
        const singleEmail = (process.env.SUPER_ADMIN_EMAIL || 'super@careerly.com').toLowerCase().trim()
        const allow = allowEmails.length > 0 ? allowEmails : [singleEmail]
        if (email && allow.includes(email)) {
          requestHeaders.set('x-superadmin', 'true')
          requestHeaders.set('x-superadmin-email', email)
        }
      }
    } catch {}
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

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
      pathname.endsWith('/admin/accept-invite') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/login') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/forgot') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/reset') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/logout') ||
      pathname.endsWith('/api/'+orgSlug+'/admin/accept-invite')
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

      // Secondary auth path: support header admin key for API calls (legacy/global admin)
      const providedKey = (req.headers.get('x-admin-key') || '').trim()
      const envKey = (process.env.ADMIN_KEY || '').trim()
      const fallbackKey = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : ''
      const allowedKeys = [envKey, fallbackKey].filter(Boolean)

      if (!adminSession) {
        const internalHeader = (req.headers.get('x-internal-token') || '').trim()
        const internalEnv = (process.env.INTERNAL_API_TOKEN || '').trim()
        if (isApi && internalHeader && internalEnv && internalHeader === internalEnv) {
          return NextResponse.next({ request: { headers: requestHeaders } })
        }
        if (isApi && providedKey && allowedKeys.includes(providedKey)) {
          return NextResponse.next({ request: { headers: requestHeaders } })
        }
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

  // Root path: no special handling here. app/page.tsx performs redirect to /start or /career/dashboard.

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
