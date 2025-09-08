import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Start() {
  return (
    <div className="min-h-screen bg-white text-zinc-900">
      {/* Top bar */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="KNET" width={120} height={28} className="h-7 w-auto" />
            <span className="text-xs text-zinc-500 hidden sm:inline">Student Dashboard</span>
          </div>
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 transition">Home</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Build a standout CV with KNET</h1>
          <p className="text-zinc-600 max-w-2xl">Choose an option below to upload your existing CV or let AI help you craft an ATS-friendly one. You can always manage submissions from the admin dashboard.</p>
        </div>
      </section>

      {/* Actions */}
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="bg-white border-zinc-200 shadow-sm hover:shadow-md transition rounded-3xl min-h-[220px]">
            <CardHeader>
              <CardTitle className="text-zinc-900">Upload CV</CardTitle>
              <CardDescription className="text-zinc-600">Upload a PDF CV. We’ll store it securely and suggest vacancies.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button asChild className="w-full h-11 rounded-xl">
                <Link href="/upload">Upload PDF</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white border-zinc-200 shadow-sm hover:shadow-md transition rounded-3xl min-h-[220px]">
            <CardHeader>
              <CardTitle className="text-zinc-900">AI CV Builder</CardTitle>
              <CardDescription className="text-zinc-600">Use our multi-step wizard and AI to create an ATS-friendly CV.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button asChild variant="secondary" className="w-full h-11 rounded-xl">
                <Link href="/ai-builder">Start Building</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white border-zinc-200 shadow-sm hover:shadow-md transition rounded-3xl min-h-[220px]">
            <CardHeader>
              <CardTitle className="text-zinc-900">Admin Dashboard</CardTitle>
              <CardDescription className="text-zinc-600">Review submissions, filter by field/interest, and download CVs.</CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button asChild variant="outline" className="w-full h-11 rounded-xl">
                <Link href="/admin">Open Admin</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
