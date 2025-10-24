import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

const ALLOWED_DECISIONS = new Set(['pending','shortlisted','rejected','interviewed','hired'])

export async function POST(request: NextRequest, { params }: { params: { org: string, id: string } }) {
  const orgSlug = params.org
  const candidateId = params.id

  // Rate limit per admin & org
  const adminIdHdr = (request.headers.get('x-admin-id') || '').trim()
  const adminEmailHdr = (request.headers.get('x-admin-email') || '').trim()
  const rlKey = `set-decision:${orgSlug}:${adminEmailHdr || adminIdHdr || 'anon'}`
  const rl = checkRateLimitWithConfig(request, { maxRequests: 30, windowMs: 60_000, namespace: rlKey })
  if (!rl.success) return createRateLimitResponse(rl)

  // Resolve org id (prefer middleware header)
  let orgId = (request.headers.get('x-org-id') || '').trim()
  try {
    if (!orgId) {
      const o = await sql`SELECT id::text FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
      orgId = (o.rows[0]?.id as string) || ''
    }
  } catch {}
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  // Validate candidate belongs to org
  try {
    const c = await sql`SELECT 1 FROM candidates WHERE id = ${candidateId}::uuid AND org_id = ${orgId}::uuid LIMIT 1`
    if (!c.rows.length) {
      return NextResponse.json({ error: 'Candidate not found in this organization' }, { status: 404 })
    }
  } catch (e) {
    return NextResponse.json({ error: 'Invalid candidate id' }, { status: 400 })
  }

  // Parse and validate payload
  let body: any
  try { body = await request.json() } catch { body = {} }
  const statusRaw = String(body?.status || '').toLowerCase().trim()
  const reasonRaw = String(body?.reason || '').trim()
  if (!ALLOWED_DECISIONS.has(statusRaw)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    // Upsert into candidate_decisions, store human reason in `reason` column
    await sql`
      INSERT INTO candidate_decisions (org_id, candidate_id, status, reason)
      VALUES (${orgId}::uuid, ${candidateId}::uuid, ${statusRaw}, NULLIF(${reasonRaw}, ''))
      ON CONFLICT (candidate_id) DO UPDATE
      SET status = EXCLUDED.status,
          reason = COALESCE(NULLIF(EXCLUDED.reason, ''), candidate_decisions.reason),
          updated_at = now()
    `

    // Fetch updated row
    const res = await sql`
      SELECT status, COALESCE(reason,'') AS reason, updated_at
      FROM candidate_decisions
      WHERE candidate_id = ${candidateId}::uuid AND org_id = ${orgId}::uuid
      LIMIT 1
    `

    // Audit log (best-effort)
    try {
      await sql`
        INSERT INTO admin_activity (organization_id, action, metadata)
        VALUES (
          ${orgId}::uuid,
          'set_candidate_decision',
          jsonb_build_object(
            'candidate_id', ${candidateId},
            'status', ${statusRaw},
            'reason', NULLIF(${reasonRaw}, ''),
            'admin_email', NULLIF(${adminEmailHdr}, '')
          )
        )
      `
    } catch {}

    const row = res.rows[0] as { status: string, reason: string, updated_at: string }
    return NextResponse.json({
      success: true,
      decision: {
        status: row.status,
        reason: row.reason,
        decision_date_utc: row.updated_at ? new Date(row.updated_at).toISOString() : null,
      }
    })
  } catch (e) {
    console.error('set-decision error', (e as any)?.message || e)
    return NextResponse.json({ error: 'Failed to set decision' }, { status: 500 })
  }
}
