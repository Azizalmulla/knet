"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Building2, Globe, User, Mail, Phone, Users, Tag, MessageSquareText, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function EnrollForm({ className = "" }: { className?: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    const payload = Object.fromEntries(fd.entries())

    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to submit")
      setSuccess(true)
    } catch (err: any) {
      setError(err?.message || "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className={`mx-auto max-w-2xl ${className}`}>
        <div className="relative rounded-[28px] border-[4px] border-black bg-[#bde0fe] p-8 shadow-[8px_8px_0_#111]">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-full bg-white border-[3px] border-black grid place-items-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight">Enrollment received</h2>
              <p className="mt-2 text-neutral-900">We’ll email you shortly to finalize your organization setup on Wathefni AI.</p>
              <div className="mt-4">
                <Link href="/" className="text-sm underline decoration-[3px] decoration-black">Back to home</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`mx-auto max-w-3xl ${className}`}>
      <div className="relative rounded-[28px] border-[4px] border-black bg-white">
        <div className="pointer-events-none absolute inset-0 translate-x-2 translate-y-2 rounded-[28px] border-[4px] border-black" aria-hidden />

        <form className="relative rounded-[24px] p-6 md:p-10 space-y-6" onSubmit={onSubmit}>
          {error ? (
            <div className="rounded-[16px] border-[3px] border-black bg-[#ffdede] p-4 text-sm">
              {error}
            </div>
          ) : null}

          {/* Company */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Building2 className="h-4 w-4" /> Company Name
              </span>
              <input
                name="companyName"
                required
                placeholder="Acme Inc."
                className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Globe className="h-4 w-4" /> Website (optional)
              </span>
              <input
                name="website"
                placeholder="https://acme.com"
                className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0"
              />
            </label>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <User className="h-4 w-4" /> Contact Name
              </span>
              <input
                name="contactName"
                required
                placeholder="Your name"
                className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4" /> Work Email
              </span>
              <input
                type="email"
                name="workEmail"
                required
                placeholder="you@company.com"
                className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Phone className="h-4 w-4" /> Phone (optional)
              </span>
              <input
                name="phone"
                placeholder="+965 …"
                className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Users className="h-4 w-4" /> Employee Count
              </span>
              <select name="employeeCount" className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0">
                <option value="">Select…</option>
                <option>1-10</option>
                <option>11-50</option>
                <option>51-200</option>
                <option>200+</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="flex flex-col gap-2">
              <span className="inline-flex items-center gap-2 font-semibold">
                <Tag className="h-4 w-4" /> Desired Org Slug (optional)
              </span>
              <input
                name="desiredOrgSlug"
                placeholder="acme"
                className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0"
              />
            </label>

            {/* honeypot */}
            <div className="hidden" aria-hidden>
              <input name="company_website" tabIndex={-1} autoComplete="off" />
            </div>
          </div>

          <label className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 font-semibold">
              <MessageSquareText className="h-4 w-4" /> Message
            </span>
            <textarea
              name="message"
              required
              minLength={20}
              rows={6}
              placeholder="Tell us about your hiring needs, org structure, expected volume, and timeline."
              className="rounded-xl border-[3px] border-black bg-white px-3 py-2 focus:outline-none focus:ring-0"
            />
          </label>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="rounded-2xl px-6 border-[3px] border-black bg-white text-black hover:-translate-y-0.5 hover:bg-zinc-100 shadow-[6px_6px_0_#111] transition-transform"
            >
              {submitting ? "Sending…" : "Submit Enrollment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
