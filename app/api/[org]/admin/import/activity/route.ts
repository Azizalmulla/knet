import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { jwtVerify } from '@/lib/esm-compat/jose'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Get recent import activity for organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { org: string } }
) {
  try {
    // Auth check
    const token = request.cookies.get('admin_session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'fallback'
    )
    
    try {
      await jwtVerify(token, secret)
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const orgSlug = params.org

    // Get organization
    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `
    
    if (orgResult.rows.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const orgId = orgResult.rows[0].id
    // Debug: log organization resolution
    console.log('[IMPORT_ACTIVITY] org resolved', { orgSlug, orgId })

    // Get recent import activity
    const activityResult = await sql`
      SELECT 
        id,
        source,
        source_email,
        candidate_count,
        success_count,
        failed_count,
        metadata,
        created_at
      FROM import_log
      WHERE org_id = ${orgId}::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `

    // Get stats
    const statsResult = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE source = 'email_import') as email_imports,
        COUNT(*) FILTER (WHERE source = 'csv_import') as csv_imports,
        COUNT(*) FILTER (WHERE source = 'pdf_bulk_import') as pdf_imports,
        SUM(success_count) as total_imported,
        SUM(failed_count) as total_failed
      FROM import_log
      WHERE org_id = ${orgId}::uuid
        AND created_at > NOW() - INTERVAL '30 days'
    `

    // Debug: log row counts
    console.log('[IMPORT_ACTIVITY] query', {
      orgId,
      rows: activityResult.rowCount,
      stats: statsResult.rows?.[0] || null
    })

    // Normalize/compute stats. If SQL returned zeros/null unexpectedly, compute from activity rows.
    const rawStats = statsResult.rows[0] || {}
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const activity30d = activityResult.rows.filter(r => {
      const t = new Date(r.created_at).getTime()
      return isFinite(t) && t >= thirtyDaysAgo
    })
    const computedStats = {
      email_imports: activity30d.filter(r => String(r.source || '').trim().toLowerCase() === 'email_import').length,
      csv_imports: activity30d.filter(r => String(r.source || '').trim().toLowerCase() === 'csv_import').length,
      pdf_imports: activity30d.filter(r => String(r.source || '').trim().toLowerCase() === 'pdf_bulk_import').length,
      total_imported: activity30d.reduce((acc, r) => acc + Number(r.success_count || 0), 0),
      total_failed: activity30d.reduce((acc, r) => acc + Number(r.failed_count || 0), 0),
    }

    // Prefer computed stats to avoid provider returning strings/nulls
    const normalizedStats = computedStats

    const res = NextResponse.json({
      activity: activityResult.rows,
      stats: normalizedStats
    })
    // Prevent any caching at the edge/browser
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.headers.set('X-Org-Id', String(orgId))
    res.headers.set('X-Activity-Rows', String(activityResult.rowCount || 0))
    return res

  } catch (error: any) {
    console.error('[IMPORT_ACTIVITY] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activity', message: error?.message },
      { status: 500 }
    )
  }
}
