import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'

/**
 * Remove unique constraint on (org_id, email_lc) to allow multiple submissions per org
 * 
 * Usage: 
 * GET /api/admin/migrate/remove-unique-constraint?token=MIGRATION_TOKEN
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token') || req.headers.get('x-migrate-token') || ''
  
  const expectedToken = process.env.MIGRATION_TOKEN || process.env.NEXTAUTH_SECRET || ''
  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results: string[] = []

    // Find and drop the unique constraint
    try {
      const constraintQuery = await sql`
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'candidates'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 2
          AND conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'candidates'::regclass AND attname = 'org_id')
          AND conkey[2] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'candidates'::regclass AND attname = 'email_lc')
      `
      
      if (constraintQuery.rows.length > 0) {
        const constraintName = constraintQuery.rows[0].conname
        await sql.query(`ALTER TABLE candidates DROP CONSTRAINT IF EXISTS ${constraintName}`)
        results.push(`✅ Dropped constraint: ${constraintName}`)
      } else {
        results.push('ℹ️  No unique constraint found on (org_id, email_lc)')
      }
    } catch (e: any) {
      results.push(`⚠️  Error finding constraint: ${e.message}`)
    }

    // Try common constraint names as fallback
    try {
      await sql`ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_org_id_email_lc_key`
      results.push('✅ Dropped fallback constraint: candidates_org_id_email_lc_key (if existed)')
    } catch (e: any) {
      results.push(`ℹ️  Fallback constraint not found: ${e.message}`)
    }

    // Add performance index
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS idx_candidates_org_email_created 
        ON candidates(org_id, email_lc, created_at DESC)
      `
      results.push('✅ Created index: idx_candidates_org_email_created')
    } catch (e: any) {
      results.push(`⚠️  Error creating index: ${e.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Migration complete. Users can now submit multiple CVs to the same organization.',
      details: results
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error?.message || String(error)
    }, { status: 500 })
  }
}
