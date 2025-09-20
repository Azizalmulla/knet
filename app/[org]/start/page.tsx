"use client"

import { notFound } from 'next/navigation'
import UploadCVForm from '@/components/upload-cv-form'
import { useLanguage } from '@/lib/language'

export default function OrgStartPage({ params }: { params: { org: string } }) {
  const { t } = useLanguage()
  
  // The org validation happens in middleware, so if we get here, it's valid
  const orgSlug = params.org
  
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t('upload_cv_title')}</h1>
          <p className="text-muted-foreground mt-2">{t('upload_cv_subtitle')}</p>
        </div>
        
        <UploadCVForm orgSlug={orgSlug} />
      </div>
    </div>
  )
}
