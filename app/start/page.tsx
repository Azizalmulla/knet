"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/language"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"

export default function Start() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar (forced white/light) */}
      <header className="border-b bg-white border-gray-200 text-gray-900">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="KNET" width={160} height={36} className="h-9 w-auto" />
            <span className="text-xs text-gray-600 hidden sm:inline">{t('student_dashboard')}</span>
          </div>
          <Link href="/" className="text-sm text-gray-900 hover:opacity-80 transition">{t('home')}</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t('build_cv_title')}</h1>
          <p className="text-muted-foreground max-w-2xl">{t('build_cv_subtitle')}</p>
        </div>
      </section>

      {/* Actions */}
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="min-h-[220px]">
            <CardHeader>
              <CardTitle className="font-bold">{t('upload_your_cv')}</CardTitle>
              <CardDescription>{/* Simple, neutral English/Arabic fits */}Upload a PDF CV. We'll store it securely and suggest vacancies.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button asChild className="w-full h-11 rounded-xl">
                <Link href="/upload">{t('upload_pdf')}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Privacy Notice */}
        <Alert className="mt-8">
          <AlertTitle>{t('privacy_notice')}</AlertTitle>
          <AlertDescription>
            <p className="text-xs leading-relaxed">{t('privacy_text').replace('{email}', 'support')}</p>
          </AlertDescription>
        </Alert>
      </main>
    </div>
  )
}
