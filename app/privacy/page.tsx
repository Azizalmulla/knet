"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language"

export default function PrivacyPage() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/student/login">{t('back_to_login')}</Link>
          </Button>
          <h1 className="text-3xl font-bold">{t('privacy_policy_title')}</h1>
          <p className="text-muted-foreground mt-2">{t('last_updated')}: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{t('info_we_collect')}</h2>
            <p>{t('info_we_collect_desc')}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{t('personal_info_item')}</li>
              <li>{t('cv_data_item')}</li>
              <li>{t('education_work_item')}</li>
              <li>{t('skills_interests_item')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('how_we_use')}</h2>
            <p>{t('how_we_use_desc')}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{t('career_matching_item')}</li>
              <li>{t('process_cv_item')}</li>
              <li>{t('communicate_item')}</li>
              <li>{t('improve_services_item')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('data_retention')}</h2>
            <p>
              {t('data_retention_desc')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('your_rights')}</h2>
            <p>{t('your_rights_desc')}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{t('access_info_item')}</li>
              <li>{t('correct_info_item')}</li>
              <li>{t('delete_data_item')}</li>
              <li>{t('export_data_item')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('security')}</h2>
            <p>
              {t('security_desc')}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t('contact_us')}</h2>
            <p>
              {t('contact_privacy_desc')}
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
