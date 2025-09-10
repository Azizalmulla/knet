"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/lib/language"

export default function Start() {
  const { t } = useLanguage()
  return (
    <div className="min-h-screen bg-background text-foreground" style={{backgroundColor: '#000000', color: '#ffffff'}}>
      {/* Top bar (white) */}
      <header className="border-b bg-white border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="KNET" width={160} height={36} className="h-9 w-auto" />
            <span className="text-xs text-zinc-600 hidden sm:inline">{t('student_dashboard')}</span>
          </div>
          <Link href="/" className="text-sm text-zinc-700 hover:text-zinc-900 transition">{t('home')}</Link>
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
      <main className="mx-auto max-w-6xl px-4 pb-16" style={{backgroundColor: '#000000'}}>
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

          <Card className="min-h-[220px]">
            <CardHeader>
              <CardTitle className="font-bold">{t('ai_cv_builder')}</CardTitle>
              <CardDescription>Use our multi-step wizard and AI to create an ATS-friendly CV.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button asChild variant="secondary" className="w-full h-11 rounded-xl">
                <Link href="/ai-builder">{t('start_building')}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="min-h-[220px]">
            <CardHeader>
              <CardTitle className="font-bold">{t('admin_dashboard')}</CardTitle>
              <CardDescription>{t('admin_dashboard_desc')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button asChild variant="outline" className="w-full h-11 rounded-xl">
                <Link href="/admin">Open Admin</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Privacy Notice */}
        <div className="mt-8 p-4 border border-white/10 rounded-lg bg-white/5">
          <h3 className="text-sm font-medium mb-2">{t('privacy_notice')}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('privacy_text').replace('{email}', 'support')}
          </p>
        </div>
      </main>
    </div>
  )
}
