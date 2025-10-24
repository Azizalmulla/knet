import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    // Check critical tables
    const [orgsReg, candReg, stuReg] = await Promise.all([
      sql<{ c: string | null }>`SELECT to_regclass('public.organizations') as c`,
      sql<{ c: string | null }>`SELECT to_regclass('public.candidates') as c`,
      sql<{ c: string | null }>`SELECT to_regclass('public.students') as c`,
    ])

    const hasOrganizations = !!orgsReg.rows?.[0]?.c
    const hasCandidates = !!candReg.rows?.[0]?.c
    const hasStudents = !!stuReg.rows?.[0]?.c

    // Check enums (best-effort)
    const [yoe, cvType, parseStatus] = await Promise.all([
      sql<{ t: string | null }>`SELECT to_regtype('yoe_bucket') as t`,
      sql<{ t: string | null }>`SELECT to_regtype('cv_type_enum') as t`,
      sql<{ t: string | null }>`SELECT to_regtype('parse_status_enum') as t`,
    ])
    const hasEnums = !!yoe.rows?.[0]?.t && !!cvType.rows?.[0]?.t && !!parseStatus.rows?.[0]?.t

    // Check seeds
    let publicOrgs = 0
    if (hasOrganizations) {
      try {
        const r = await sql`SELECT COUNT(*)::int as c FROM organizations WHERE COALESCE(is_public,true) = true AND deleted_at IS NULL`
        publicOrgs = Number(r.rows?.[0]?.c || 0)
      } catch {}
    }

    const ready = hasOrganizations && (hasCandidates || hasStudents) && hasEnums && publicOrgs > 0

    // DB identity info (best-effort)
    let dbInfo: { db?: string; db_user?: string } = {}
    try {
      const info = await sql<{ db: string; db_user: string }>`SELECT current_database()::text as db, current_user::text as db_user`
      dbInfo = { db: info.rows?.[0]?.db, db_user: info.rows?.[0]?.db_user }
    } catch {}

    const missing: string[] = []
    if (!hasOrganizations) missing.push('organizations table')
    if (!hasCandidates && !hasStudents) missing.push('candidates (or legacy students) table')
    if (!hasEnums) missing.push('enums: yoe_bucket, cv_type_enum, parse_status_enum')
    if (publicOrgs <= 0) missing.push('seeded public organizations')

    const instructions: string[] = []
    if (!ready) {
      instructions.push(
        'Run the one-click migration on this domain: POST /api/admin/migrate with header x-migrate-token set to MIGRATION_TOKEN (or GET /api/admin/migrate?token=...)',
      )
      instructions.push('In Vercel → Project → Settings → Environment Variables, set MIGRATION_TOKEN to a secret value (or reuse NEXTAUTH_SECRET).')
      instructions.push('Re-run the migration endpoint, then refresh /start and /submit.')
    }

    return NextResponse.json({ ok: ready, ready, missing, publicOrgs, db: dbInfo }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, ready: false, error: String(e?.message || e) }, { status: 200 })
  }
}
