"use client"

import { useEffect } from 'react'
import { notFound, useRouter } from 'next/navigation'
import AdminDashboard from '@/components/admin-dashboard'
import { useLanguage } from '@/lib/language'
import { Button } from '@/components/ui/button'

export default function OrgAdminPage({ params }: { params: { org: string } }) {
  const { t } = useLanguage()
  const orgSlug = params.org
  const router = useRouter()

  // Store org context for admin API calls
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('current_org', orgSlug)
    }
  }, [orgSlug])
  
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('admin_dashboard')}</h1>
            <p className="text-sm text-muted-foreground mt-1">Organization: {orgSlug}</p>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await fetch(`/api/${orgSlug}/admin/logout`, { method: 'POST' })
                } catch {}
                router.push(`/${orgSlug}/admin/login`)
              }}
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
      
      <AdminDashboard orgSlug={orgSlug} />
    </div>
  )
}
