import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { sql } from '@/lib/db'
import StudentDashboard from '@/components/student-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Result shape expected by the dashboard component
interface SubmissionRow {
  id: string
  name: string
  email: string
  phone: string
  cv_file_key: string
  created_at: string
  parse_status: string
  cv_type?: string
  ai_feedback?: string
  decision_status?: string
  knet_profile: any
  org_name: string
  org_slug: string
  org_logo: string | null
}

export default async function CareerDashboardPage({
  searchParams,
}: {
  searchParams: { org?: string }
}) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user?.email) {
    redirect('/student/login')
  }
  // Prefer org from query string; fallback to last selected org from student_orgs
  let orgSlug = searchParams?.org?.trim()
  if (!orgSlug) {
    try {
      const { rows } = await sql`SELECT org_slug FROM student_orgs WHERE email = ${user.email.toLowerCase()} LIMIT 1;`
      if (rows.length && rows[0].org_slug) {
        orgSlug = String(rows[0].org_slug)
      }
    } catch {}
  }
  // Validate org exists and get display name/logo (if provided)
  let orgName = orgSlug || ''
  let orgLogo: string | null = null
  if (orgSlug) {
    try {
      const { rows } = await sql`SELECT name, logo_url FROM organizations WHERE slug = ${orgSlug} LIMIT 1;`
      if (!rows.length) {
        // If invalid org slug provided, ignore and continue in All Orgs mode
      } else {
        orgName = rows[0].name as string
        orgLogo = (rows[0].logo_url as string) || null
      }
    } catch {}
  }

  // Load submissions for this user scoped to selected organization (default view)
  let submissions: SubmissionRow[] = []
  // Load submissions across all orgs for this user (for toggle)
  let submissionsAll: SubmissionRow[] = []
  try {
    const emailLower = user.email.toLowerCase()
    // Selected org (if provided)
    if (orgSlug) {
      const resSel = await sql<SubmissionRow>`
        SELECT 
          c.id::text,
          c.full_name AS name,
          c.email,
          COALESCE(c.phone, '') AS phone,
          COALESCE(c.cv_blob_key, '') AS cv_file_key,
          COALESCE(c.created_at, NOW()) AS created_at,
          COALESCE(c.parse_status::text, 'completed') AS parse_status,
          COALESCE(c.cv_type::text, NULL) AS cv_type,
          NULL::jsonb AS knet_profile,
          COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
          COALESCE(d.status, 'pending') AS decision_status,
          COALESCE(o.name, o.slug) AS org_name,
          COALESCE(o.slug, '') AS org_slug,
          COALESCE(o.logo_url, NULL)::text AS org_logo
        FROM public.candidates c
        LEFT JOIN organizations o ON o.id = c.org_id
        LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
        LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
        WHERE LOWER(c.email) = ${emailLower} AND o.slug = ${orgSlug} AND COALESCE(c.deleted_at, NULL) IS NULL
        ORDER BY c.created_at DESC NULLS LAST
        LIMIT 50;
      `
      submissions = resSel.rows
    }
    // All orgs dataset
    const resAll = await sql<SubmissionRow>`
      SELECT 
        c.id::text,
        c.full_name AS name,
        c.email,
        COALESCE(c.phone, '') AS phone,
        COALESCE(c.cv_blob_key, '') AS cv_file_key,
        COALESCE(c.created_at, NOW()) AS created_at,
        COALESCE(c.parse_status::text, 'completed') AS parse_status,
        COALESCE(c.cv_type::text, NULL) AS cv_type,
        NULL::jsonb AS knet_profile,
        COALESCE(a.ai_feedback, NULL)::text AS ai_feedback,
        COALESCE(d.status, 'pending') AS decision_status,
        COALESCE(o.name, o.slug) AS org_name,
        COALESCE(o.slug, '') AS org_slug,
        COALESCE(o.logo_url, NULL)::text AS org_logo
      FROM public.candidates c
      LEFT JOIN organizations o ON o.id = c.org_id
      LEFT JOIN cv_analysis a ON a.candidate_id = c.id AND a.org_id = c.org_id
      LEFT JOIN candidate_decisions d ON d.candidate_id = c.id AND d.org_id = c.org_id
      WHERE LOWER(c.email) = ${emailLower} AND COALESCE(c.deleted_at, NULL) IS NULL
      ORDER BY c.created_at DESC NULLS LAST
      LIMIT 100;
    `
    submissionsAll = resAll.rows
  } catch (error) {
    // Database not configured or table doesn't exist yet
    // This is fine for new users or when DB isn't set up
    console.error('Failed to load submissions:', error)
    submissions = []
    submissionsAll = []
  }

  return (
    <Suspense fallback={<div>Loading submissions...</div>}>
      <StudentDashboard 
        email={user.email} 
        submissions={submissions}
        submissionsAll={submissionsAll}
        selectedOrgSlug={orgSlug}
        selectedOrgName={orgName}
        selectedOrgLogo={orgLogo}
      />
    </Suspense>
  )
}
