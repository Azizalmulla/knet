import UploadCVForm from '@/components/upload-cv-form'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { sql } from '@vercel/postgres'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function UploadPage({
  searchParams,
}: {
  searchParams: { org?: string }
}) {
  const orgSlug = searchParams?.org?.trim()
  if (!orgSlug) redirect('/start')

  let orgName = orgSlug
  try {
    const { rows } = await sql`SELECT name FROM organizations WHERE slug = ${orgSlug} LIMIT 1;`
    if (!rows.length) redirect('/start')
    orgName = rows[0].name as string
  } catch {
    redirect('/start')
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#eeeee4] text-neutral-900">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold mb-2">Submit your CV to {orgName}</h1>
            <p className="text-neutral-700">Upload your CV (PDF/Doc/Image) and we will process it.</p>
          </div>
          <Suspense fallback={<div className="py-10">Loading form…</div>}>
            <UploadCVForm orgSlug={orgSlug} />
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  )
}
