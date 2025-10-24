import { redirect } from 'next/navigation'

export default async function StudentDashboardRedirect({
  searchParams,
}: {
  searchParams: { org?: string }
}) {
  const org = (searchParams?.org || '').trim()
  const target = org ? `/career/dashboard?org=${encodeURIComponent(org)}` : '/start'
  redirect(target)
}
