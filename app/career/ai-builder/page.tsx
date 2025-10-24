import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CareerAIBuilderAlias({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams || {})) {
    if (typeof v === 'string') params.set(k, v)
    else if (Array.isArray(v)) v.forEach((vv) => params.append(k, vv))
  }
  const qs = params.toString()
  redirect(`/ai-builder${qs ? `?${qs}` : ''}`)
}
