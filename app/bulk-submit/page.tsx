import { sql } from '@vercel/postgres'
import UploadCVForm from '@/components/upload-cv-form'
import Link from 'next/link'

export default async function BulkSubmitPage({ searchParams }: { searchParams: { orgs?: string; mode?: string } }) {
  const orgsParam = (searchParams?.orgs || '').trim()
  const mode = (searchParams?.mode || 'upload').toLowerCase()
  const slugs = orgsParam ? orgsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10) : []
  if (slugs.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">No companies selected</h1>
          <p className="text-muted-foreground mb-4">Go back and choose one or more companies.</p>
          <Link href="/start" className="underline">Return to Company Picker</Link>
        </div>
      </div>
    )
  }

  // Fetch names for display (best-effort)
  let orgs: { slug: string; name: string }[] = slugs.map(s => ({ slug: s, name: s }))
  try {
    const rows: any[] = []
    // For <=50 slugs, individual lookups are acceptable and avoid TS issues with ANY(array)
    for (const s of slugs) {
      const r = await sql`SELECT slug, name FROM organizations WHERE slug = ${s} LIMIT 1`
      if (r.rows?.[0]) rows.push(r.rows[0])
    }
    if (rows.length) {
      const map = new Map(rows.map((r: any) => [r.slug, r.name]))
      orgs = slugs.map(s => ({ slug: s, name: map.get(s) || s }))
    }
  } catch {}

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold">Bulk Submission</h1>
          <p className="text-sm text-muted-foreground">You selected {slugs.length} compan{slugs.length === 1 ? 'y' : 'ies'}.</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="bg-muted/20 border rounded-md p-4">
          <h2 className="font-semibold mb-2">Selected companies</h2>
          <ul className="list-disc pl-5">
            {orgs.map(o => (
              <li key={o.slug}>{o.name}</li>
            ))}
          </ul>
        </div>

        {mode === 'ai' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">You chose AI Builder. Continue to create your CV, then it will be submitted to all selected companies.</p>
            <Link href={`/career/ai-builder?orgs=${encodeURIComponent(slugs.join(','))}`} className="inline-block bg-white text-black px-4 py-2 rounded border">
              Open AI CV Builder
            </Link>
          </div>
        ) : mode === 'voice' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">You chose Voice-to-CV. Continue to record your voice, then your CV will be submitted to all selected companies.</p>
            <Link href={`/voice-cv?orgs=${encodeURIComponent(slugs.join(','))}`} className="inline-block bg-gradient-to-br from-[#e0c3fc] to-[#8ec5fc] text-black font-bold px-4 py-2 rounded border border-black">
              Open Voice-to-CV
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Upload your CV once; we will submit it to all selected companies.</p>
            <UploadCVForm orgSlugs={slugs} />
          </div>
        )}

        <div>
          <Link href="/start" className="underline text-sm">Back to Company Picker</Link>
        </div>
      </main>
    </div>
  )
}
