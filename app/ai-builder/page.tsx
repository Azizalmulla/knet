import AICVBuilder from '@/components/ai-cv-builder';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Suspense } from 'react';
import { sql } from '@vercel/postgres'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AIBuilderPage({
  searchParams,
}: {
  searchParams: { org?: string; orgs?: string }
}) {
  const orgSlug = searchParams?.org?.trim()
  const orgsParam = searchParams?.orgs?.trim()
  // If neither single org nor multi-org provided, allow generic builder view (no redirect)
  // Validate single organization exists; for multi-org, skip validation here
  let headerTitle = 'AI CV Builder'
  let subTitle: string | null = null
  if (orgSlug) {
    let orgName = orgSlug
    try {
      const { rows } = await sql`SELECT name FROM organizations WHERE slug = ${orgSlug} LIMIT 1;`
      if (rows.length === 0) redirect('/start')
      orgName = rows[0].name as string
    } catch {
      redirect('/start')
    }
    headerTitle = `AI CV Builder — ${orgName}`
    subTitle = `Build a new CV to submit to ${orgName}`
  } else if (orgsParam) {
    headerTitle = 'AI CV Builder — Multiple organizations'
    subTitle = 'Build a new CV and we will submit it to your selected organizations'
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-[#eeeee4] text-neutral-900 flex items-center justify-center p-4">Loading builder...</div>}>
        <div className="min-h-screen bg-[#eeeee4] text-neutral-900">
          <div className="container mx-auto p-4">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{headerTitle}</h1>
              {subTitle && (
                <p className="text-muted-foreground">{subTitle}</p>
              )}
            </div>
            <AICVBuilder />
          </div>
        </div>
      </Suspense>
    </ErrorBoundary>
  );
}
