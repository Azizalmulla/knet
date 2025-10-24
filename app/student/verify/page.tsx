"use client"

import { Mail, Loader2 } from "lucide-react"
import Link from "next/link"

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#eeeee4] text-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-white border-[3px] border-black flex items-center justify-center shadow-[6px_6px_0_#111]">
            <Mail className="w-10 h-10 text-black" />
          </div>
        </div>

        {/* Title and Message */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-black mb-4">Check your email</h1>
          <p className="text-neutral-600 mb-2">A sign-in link has been sent to your email address.</p>
          <p className="text-neutral-600 text-sm">Click the link in the email to sign in. The link will expire in 15 minutes.</p>
        </div>

        {/* Tips */}
        <div className="relative rounded-[20px] border-[3px] border-black bg-white p-6 text-left shadow-[6px_6px_0_#111]">
          <h2 className="font-semibold mb-3">Didn't receive the email?</h2>
          <ul className="space-y-2 text-sm text-neutral-700">
            <li>• Check your spam or junk folder</li>
            <li>• Make sure you entered the correct email</li>
            <li>• Wait a few minutes and try again</li>
          </ul>
        </div>

        {/* Return Link */}
        <div>
          <Link href="/student/login" className="text-sm text-neutral-700 underline decoration-[3px] decoration-black hover:text-black">
            Return to login
          </Link>
        </div>
      </div>
    </div>
  )
}
