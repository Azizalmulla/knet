"use client"

import { Mail, Loader2 } from "lucide-react"
import Link from "next/link"

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center">
            <Mail className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Title and Message */}
        <div>
          <h1 className="text-3xl font-bold mb-4">Check your email</h1>
          <p className="text-zinc-400 mb-2">
            A sign-in link has been sent to your email address.
          </p>
          <p className="text-zinc-400 text-sm">
            Click the link in the email to sign in. The link will expire in 15 minutes.
          </p>
        </div>

        {/* Tips */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-left">
          <h2 className="font-semibold mb-3">Didn't receive the email?</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• Check your spam or junk folder</li>
            <li>• Make sure you entered the correct email</li>
            <li>• Wait a few minutes and try again</li>
          </ul>
        </div>

        {/* Return Link */}
        <div>
          <Link
            href="/student/login"
            className="text-sm text-zinc-400 hover:text-white underline"
          >
            Return to login
          </Link>
        </div>
      </div>
    </div>
  )
}
