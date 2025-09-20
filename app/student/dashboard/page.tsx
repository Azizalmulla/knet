import { getServerSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import StudentDashboard from "@/components/student-dashboard"

export default async function StudentDashboardPage() {
  const session = await getServerSession()
  
  if (!session?.user?.email) {
    redirect("/student/login")
  }

  // Fetch student's submissions
  const result = await sql`
    SELECT 
      c.id,
      c.name,
      c.email,
      c.phone,
      c.cv_file_key,
      c.created_at,
      c.parse_status,
      c.knet_profile,
      o.name as org_name,
      o.slug as org_slug,
      o.logo_url as org_logo
    FROM candidates c
    JOIN organizations o ON c.org_id = o.id
    WHERE lower(c.email) = ${session.user.email.toLowerCase()}
    ORDER BY c.created_at DESC
  `
  const submissions = result.rows

  // Update student_user_id for backfill if needed
  if (submissions.length > 0) {
    const studentUserResult = await sql`
      SELECT id FROM student_users 
      WHERE lower(email) = ${session.user.email.toLowerCase()}
    `
    
    if (studentUserResult.rows.length > 0) {
      // You could add a student_user_id column to candidates table if needed
      // For now, we're just linking by email
    }
  }

  return (
    <StudentDashboard 
      session={session}
      submissions={submissions}
    />
  )
}
