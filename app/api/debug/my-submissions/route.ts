import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { createServerClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Debug endpoint to check:
 * 1. What email you're logged in as
 * 2. All submissions for that email across all orgs
 * 3. Whether email_lc matches
 * 
 * Usage: GET /api/debug/my-submissions
 */
export async function GET(req: NextRequest) {
  // Get authenticated email
  let emailLower: string | null = null
  let authMethod = 'none'
  
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      emailLower = user.email.toLowerCase()
      authMethod = 'supabase'
    }
  } catch {}

  if (!emailLower) {
    return NextResponse.json({
      authenticated: false,
      message: 'Not logged in. Please log in at /student/login',
      authMethod
    }, { status: 401 })
  }

  try {
    // Check candidates table
    const candidates = await sql`
      SELECT 
        c.id::text,
        c.email,
        c.email_lc,
        c.full_name,
        c.cv_type::text,
        c.parse_status::text,
        c.created_at,
        o.slug AS org_slug,
        o.name AS org_name,
        COALESCE(c.cv_blob_key, '') AS cv_blob_key
      FROM candidates c
      LEFT JOIN organizations o ON o.id = c.org_id
      WHERE c.email_lc = ${emailLower}
        AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 50
    `

    // Also check if there are any with similar emails (case mismatch)
    const similar = await sql`
      SELECT 
        c.id::text,
        c.email,
        c.email_lc,
        c.full_name,
        o.slug AS org_slug
      FROM candidates c
      LEFT JOIN organizations o ON o.id = c.org_id
      WHERE LOWER(c.email) = ${emailLower}
        AND c.email_lc != ${emailLower}
        AND c.deleted_at IS NULL
      LIMIT 10
    `

    return NextResponse.json({
      authenticated: true,
      authMethod,
      loggedInAs: emailLower,
      submissions: {
        count: candidates.rows.length,
        items: candidates.rows
      },
      potentialMismatches: {
        count: similar.rows.length,
        items: similar.rows,
        note: similar.rows.length > 0 
          ? 'Found submissions with email case mismatch. This should not happen with GENERATED ALWAYS column.'
          : 'No case mismatches found.'
      },
      instructions: {
        ifEmpty: 'No submissions found. Either you have not submitted yet, or you are logged in with a different email than the one used during submission.',
        checkEmail: `Make sure you submitted with this email: ${emailLower}`,
        checkOrg: 'Make sure you selected the correct organization when submitting.'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      authenticated: true,
      loggedInAs: emailLower,
      error: 'Database query failed',
      details: error?.message || String(error)
    }, { status: 500 })
  }
}
