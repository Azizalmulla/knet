"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import EnrollForm from "@/components/enroll/enroll-form"

export default function EnrollPage() {
  return (
    <main className="min-h-screen bg-[#eeeee4] text-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-16">
        <div className="mx-auto max-w-3xl mb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm underline decoration-[3px] decoration-black">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
        <header className="mx-auto max-w-3xl mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Enroll your company</h1>
          <p className="mt-2 text-neutral-700">Tell us about your organization and we’ll get you onboarded.</p>
        </header>
        <EnrollForm />
      </div>
    </main>
  )
}
