import { createServerClient } from '@/lib/supabase-server'
import CompanyPicker from './company-picker'
import { Suspense } from 'react'

type OrgRow = {
  id: string | number
  name: string
  slug: string
  is_public: boolean
}

export default async function Start() {
  // Render multi-select company picker regardless of auth status
  await createServerClient() // ensure same SSR behavior
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eeeee4] text-neutral-900 flex items-center justify-center">Loading…</div>}>
      <CompanyPicker />
    </Suspense>
  )
}
