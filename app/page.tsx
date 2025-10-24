"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Shield, Lock, Globe2, Upload, Sparkles, LayoutDashboard, FileText, CheckCircle2 } from "lucide-react"
import { AppleCardsCarouselDemo } from "@/components/benefits/AppleCardsCarouselDemo"
import { Space_Grotesk } from "next/font/google"
import EnrollForm from "@/components/enroll/enroll-form"
import careerlyLogo from "../images/ChatGPT Image Oct 4, 2025, 12_38_29 PM.png"
import heroCard from "../images/ChatGPT Image Oct 4, 2025, 12_38_29 PM.png"
import JobFinderWidget from "@/components/jobs/JobFinderWidget"
import { useLanguage } from "@/lib/language"

const sg = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-geist-sans" })

export default function Home() {
  const { t } = useLanguage()
  return (
    <div className={`${sg.className} ${sg.variable} relative min-h-screen bg-[#eeeee4] text-neutral-900 overflow-hidden`}>
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-zinc-700/30 via-zinc-900/0 to-zinc-900/0 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-gradient-to-br from-emerald-600/25 to-cyan-600/10 blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-black/20">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={heroCard}
              alt="Wathefni AI"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
              priority
            />
            <span className="text-lg font-bold tracking-tight">{t('company_name')}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-600">
            <a href="#contact" className="hover:text-neutral-900 transition-colors">{t('contact')}</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/admin/login">
              <Button variant="outline" className="rounded-2xl px-5 text-neutral-900 border-neutral-900 hover:bg-neutral-200">{t('admin_login')}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-12 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10 items-center">
          <div>
            <h1 className={`mt-5 text-3xl sm:text-4xl md:text-6xl font-extrabold tracking-tight leading-tight inline-block border-b-[4px] border-black pr-2`}>
              {t('hero_title_line1')}
              <br className="hidden sm:block" /> {t('hero_title_line2')}
            </h1>
            <p className="mt-5 max-w-xl text-neutral-600">
              {t('hero_subtitle')}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/student/login">
                <Button size="lg" className="rounded-2xl px-6 border-2 border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform">
                  {t('enter_app')}
                </Button>
              </Link>
              <Link href="/student/login?redirectTo=/career/dashboard">
                <Button size="lg" className="rounded-2xl px-6 border-2 border-black bg-[#ffd6a5] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform">
                  {t('career_dashboard')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <JobFinderWidget renderHeroButton />
            </div>
            <div className="mt-6 text-sm text-neutral-600">
              {t('privacy_first')} • {t('bilingual_ready')} • {t('secure_storage')}
            </div>
          </div>
          <div className="relative">
            <div className="relative w-full h-[240px] sm:h-[320px] md:h-[380px] overflow-hidden">
              <Image
                src={careerlyLogo}
                alt="Wathefni AI Hero"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits - Apple Cards Carousel (Aceternity demo style) */}
      <div className="hidden md:block">
        <AppleCardsCarouselDemo />
      </div>
      {/* Simple mobile benefits (fallback) */}
      <section className="block md:hidden px-4 mt-2">
        <div className="mx-auto max-w-7xl">
          <div className="space-y-3">
            <div className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[6px_6px_0_#111]">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5" />
                <p className="font-semibold">{t('ai_cv_builder_benefit')}</p>
              </div>
              <p className="text-sm text-neutral-700 mt-1">{t('ai_cv_builder_desc')}</p>
            </div>
            <div className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[6px_6px_0_#111]">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                <p className="font-semibold">{t('instant_parsing')}</p>
              </div>
              <p className="text-sm text-neutral-700 mt-1">{t('instant_parsing_desc')}</p>
            </div>
            <div className="rounded-2xl border-[3px] border-black bg-white p-4 shadow-[6px_6px_0_#111]">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                <p className="font-semibold">{t('privacy_first_benefit')}</p>
              </div>
              <p className="text-sm text-neutral-700 mt-1">{t('privacy_first_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Split CTA Band: Students vs HR (neo-brutalist, no cards) */}
      <section aria-labelledby="audiences" className="mt-16">
        <div className="mx-auto max-w-7xl px-4">
          {/* Band frame */}
          <div className="relative overflow-hidden rounded-[28px] border-[3px] md:border-[4px] border-black bg-[#f3efdf]">
            {/* Offset shadow */}
            <div className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded-[28px] border-[3px] md:border-[4px] border-black" aria-hidden />

            <div className="relative rounded-[24px] p-8 md:p-12">
              <div className="mb-8 md:mb-10">
                <h2 id="audiences" className="text-3xl md:text-4xl font-extrabold tracking-tight">
                  {t('choose_your_path')}
                </h2>
                <p className="mt-2 text-neutral-600">{t('choose_path_desc')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12">
                {/* Students column */}
                <div>
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-white border-[3px] border-black grid place-items-center" aria-hidden>
                      <Upload className="h-5 w-5" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold">{t('students')}</h3>
                  </div>
                  <p className="mt-3 text-neutral-700">{t('students_desc')}</p>

                  <ul className="mt-5 flex flex-wrap gap-3" role="list">
                    <li className="inline-flex items-center gap-2 rounded-full bg-white border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_#111]">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      <span className="text-sm">{t('ai_cv_improvements')}</span>
                    </li>
                    <li className="inline-flex items-center gap-2 rounded-full bg-white border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_#111]">
                      <FileText className="h-4 w-4" aria-hidden />
                      <span className="text-sm">{t('browse_jobs')}</span>
                    </li>
                    <li className="inline-flex items-center gap-2 rounded-full bg-white border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_#111]">
                      <ArrowRight className="h-4 w-4" aria-hidden />
                      <span className="text-sm">{t('multi_company_apply')}</span>
                    </li>
                  </ul>

                  <div className="mt-6">
                    <Link href="/student/login" className="inline-flex">
                      <Button className="rounded-2xl px-6 border-[3px] border-black bg-white text-black hover:-translate-y-0.5 hover:bg-zinc-100 shadow-[6px_6px_0_#111] transition-transform">
                        {t('start_as_student')}
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* HR column */}
                <div className="md:border-l-[3px] md:border-black/30 md:pl-12">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-white border-[3px] border-black grid place-items-center" aria-hidden>
                      <Shield className="h-5 w-5" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-extrabold">{t('hr_teams')}</h3>
                  </div>
                  <p className="mt-3 text-neutral-700">{t('hr_teams_desc')}</p>

                  <ul className="mt-5 flex flex-wrap gap-3" role="list">
                    <li className="inline-flex items-center gap-2 rounded-full bg-white border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_#111]">
                      <LayoutDashboard className="h-4 w-4" aria-hidden />
                      <span className="text-sm">{t('post_job_openings')}</span>
                    </li>
                    <li className="inline-flex items-center gap-2 rounded-full bg-white border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_#111]">
                      <Sparkles className="h-4 w-4" aria-hidden />
                      <span className="text-sm">{t('ai_recruiting_agent')}</span>
                    </li>
                    <li className="inline-flex items-center gap-2 rounded-full bg-white border-[3px] border-black px-3 py-1 shadow-[4px_4px_0_#111]">
                      <Shield className="h-4 w-4" aria-hidden />
                      <span className="text-sm">{t('track_applications')}</span>
                    </li>
                  </ul>

                  <div className="mt-5 rounded-xl bg-white/50 border-[2px] border-black/20 p-4">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      {t('talk_to_ai_recruiter')}
                    </p>
                    <p className="text-xs text-neutral-600 italic mb-2">
                      "{t('ai_recruiter_example')}"
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs bg-white rounded-full px-2 py-1 border border-black/20">{t('ranks_candidates')}</span>
                      <span className="text-xs bg-white rounded-full px-2 py-1 border border-black/20">{t('sends_emails')}</span>
                      <span className="text-xs bg-white rounded-full px-2 py-1 border border-black/20">{t('natural_language')}</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Link href="/admin/login" className="inline-flex">
                      <Button className="rounded-2xl px-6 border-[3px] border-black bg-white text-black hover:-translate-y-0.5 hover:bg-zinc-100 shadow-[6px_6px_0_#111] transition-transform">
                        {t('for_hr_teams')}
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works (neo-brutalist stacked checklist) */}
      <section aria-labelledby="how-it-works" className="mt-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 md:mb-10">
            <h2 id="how-it-works" className="text-3xl md:text-4xl font-extrabold tracking-tight">
              {t('how_it_works')}
            </h2>
            <p className="mt-2 text-neutral-600">{t('three_steps_simple')}</p>
          </div>

          {/* Band frame with offset shadow */}
          <div className="relative overflow-hidden rounded-[28px] border-[3px] md:border-[4px] border-black bg-transparent">
            <div className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded-[28px] border-[3px] md:border-[4px] border-black" aria-hidden />

            <div className="relative rounded-[24px] p-2 md:p-4">
              <div className="space-y-6 md:space-y-8">
                {/* Row 1 (blue) */}
                <div className="relative rounded-[20px] border-[3px] border-black bg-[#bde0fe] p-5 md:p-6 shadow-[6px_6px_0_#111]">
                  <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                    <div className="flex items-center gap-3 md:min-w-[220px]">
                      <div className="h-9 w-9 rounded-md bg-white border-[3px] border-black grid place-items-center" aria-hidden>
                        <Upload className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl md:text-2xl font-extrabold">Build Your CV</h3>
                    </div>
                    <p className="text-neutral-900">Upload your existing CV or build a professional one from scratch with AI — get ATS-ready output in 2 minutes with multiple themes.</p>
                  </div>
                </div>

                {/* Row 2 (peach) */}
                <div className="relative rounded-[20px] border-[3px] border-black bg-[#ffd6a5] p-5 md:p-6 shadow-[6px_6px_0_#111]">
                  <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                    <div className="flex items-center gap-3 md:min-w-[220px]">
                      <div className="h-9 w-9 rounded-md bg-white border-[3px] border-black grid place-items-center" aria-hidden>
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl md:text-2xl font-extrabold">Browse & Match Jobs</h3>
                    </div>
                    <p className="text-neutral-900">Search 100+ real job openings from Kuwait's top companies. AI analyzes your CV and shows you the best matches for your profile.</p>
                  </div>
                </div>

                {/* Row 3 (pink) */}
                <div className="relative rounded-[20px] border-[3px] border-black bg-[#ffdede] p-5 md:p-6 shadow-[6px_6px_0_#111]">
                  <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                    <div className="flex items-center gap-3 md:min-w-[220px]">
                      <div className="h-9 w-9 rounded-md bg-white border-[3px] border-black grid place-items-center" aria-hidden>
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <h3 className="text-xl md:text-2xl font-extrabold">Apply Everywhere</h3>
                    </div>
                    <p className="text-neutral-900">Select multiple companies and apply to all with one click. Track all your applications, interviews, and responses in your personal dashboard.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why choose us comparison section */}
      <section aria-labelledby="why-choose-us" className="mt-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 md:mb-10 text-center">
            <h2 id="why-choose-us" className="text-3xl md:text-4xl font-extrabold tracking-tight">
              {t('why_wathefni')}
            </h2>
            <p className="mt-2 text-neutral-600 text-lg">{t('only_platform_does_all')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Traditional CV Builders */}
            <div className="relative overflow-hidden rounded-[24px] border-[3px] border-black bg-white p-6 shadow-[6px_6px_0_#111]">
              <div className="mb-4">
                <h3 className="text-xl font-extrabold mb-2">Traditional CV Builders</h3>
                <p className="text-sm text-neutral-600">Canva, Resume.io, etc.</p>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">Just make CVs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">No job listings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">Manual applications</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">No AI recruiting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">Limited Arabic support</span>
                </li>
              </ul>
            </div>

            {/* Job Boards */}
            <div className="relative overflow-hidden rounded-[24px] border-[3px] border-black bg-white p-6 shadow-[6px_6px_0_#111]">
              <div className="mb-4">
                <h3 className="text-xl font-extrabold mb-2">Job Boards</h3>
                <p className="text-sm text-neutral-600">LinkedIn, Bayt, etc.</p>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">No CV builder</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">Apply one by one</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">No AI improvements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">Complex for employers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span className="text-sm">Not Kuwait-focused</span>
                </li>
              </ul>
            </div>

            {/* Wathefni AI */}
            <div className="relative rounded-[24px] border-[4px] border-black bg-[#ffd6a5] p-6 shadow-[8px_8px_0_#111]">
              <div className="absolute top-2 right-2 bg-black text-white px-3 py-1 rounded-full text-xs font-bold">
                ⭐ Best Choice
              </div>
              <div className="mb-4">
                <h3 className="text-xl font-extrabold mb-2">Wathefni AI</h3>
                <p className="text-sm text-neutral-900 font-semibold">Complete AI-Powered Platform</p>
              </div>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">AI CV builder with multiple professional themes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">Smart AI improvements (shorter, stronger, keywords)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">100+ active job listings from top Kuwait companies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">Apply to 50+ companies with one click</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">AI recruiting agent (natural language search)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">Full Arabic & English support (RTL interface)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">Complete application tracking dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">Built specifically for Kuwait market</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="text-sm font-medium">Post jobs & manage candidates (HR teams)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Enroll form embedded under How Wathefni AI works */}
      <section aria-labelledby="enroll" className="mt-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-6 md:mb-8">
            <h2 id="enroll" className="text-3xl md:text-4xl font-extrabold tracking-tight">{t('enroll_your_company')}</h2>
            <p className="mt-2 text-neutral-600">{t('tell_us_about_org')}</p>
          </div>
          <EnrollForm />
        </div>
      </section>

      {/* Curved dashed arrow styles moved to app/globals.css */}

      {/* Footer */}
      <footer id="contact" className="border-t border-black/10">
        <div className="mx-auto max-w-7xl px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-600">
          <div className="flex items-center gap-2">
            <Image src={careerlyLogo} alt="Wathefni AI" width={20} height={20} className="h-5 w-5 rounded" />
            <span>© {new Date().getFullYear()} Wathefni AI</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center md:justify-end">
            <Link href="/upload" className="hover:text-foreground transition-colors">Upload</Link>
            <Link href="/ai-builder" className="hover:text-foreground transition-colors">AI Builder</Link>
            <Link href="/admin/login" className="hover:text-foreground transition-colors">Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}