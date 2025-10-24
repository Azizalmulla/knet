"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language"

export default function TermsPage() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/student/login">{t('back_to_login')}</Link>
          </Button>
          <h1 className="text-3xl font-bold">{t('terms_of_service_title')}</h1>
          <p className="text-muted-foreground mt-2">{t('last_updated')}: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{t('acceptance_of_terms')}</h2>
            <p>
              {t('acceptance_desc')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('use_license')}</h2>
            <p>
              {t('use_license_desc')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('data_usage')}</h2>
            <p>
              {t('data_usage_desc')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('privacy_section')}</h2>
            <p>
              {t('privacy_section_desc')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('contact_information')}</h2>
            <p>
              {t('contact_terms_desc')}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
