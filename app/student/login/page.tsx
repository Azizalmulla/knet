"use client"

import { signIn } from "next-auth/react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

export default function StudentLoginPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/student/dashboard"
  const error = searchParams.get("error")

  // Show error toast if there's an error
  if (error) {
    toast.error(
      error === "OAuthAccountNotLinked"
        ? "Email already in use with another provider"
        : "An error occurred during sign in"
    )
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    setProvider("email")
    
    try {
      const result = await signIn("email", {
        email,
        redirect: false,
        callbackUrl,
      })

      if (result?.error) {
        toast.error("Failed to send magic link. Please try again.")
      } else {
        toast.success("Check your email for a sign-in link.")
        setEmail("")
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
      setProvider(null)
    }
  }

  const handleOAuthSignIn = (provider: string) => {
    setProvider(provider)
    signIn(provider, { callbackUrl })
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Welcome to Careerly</h1>
          <p className="text-zinc-400">Sign in to manage your applications</p>
        </div>

        {/* Sign in Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
          {/* OAuth Providers */}
          <div className="space-y-3">
            <Button
              className="w-full h-12 bg-white hover:bg-gray-100 text-black font-medium rounded-xl"
              onClick={() => handleOAuthSignIn("google")}
              disabled={isLoading}
            >
              {provider === "google" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            <Button
              className="w-full h-12 bg-[#0078D4] hover:bg-[#106EBE] text-white font-medium rounded-xl"
              onClick={() => handleOAuthSignIn("azure-ad")}
              disabled={isLoading}
            >
              {provider === "azure-ad" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21">
                    <path fill="#f25022" d="M0 0h10v10H0z" />
                    <path fill="#00a4ef" d="M0 11h10v10H0z" />
                    <path fill="#7fba00" d="M11 0h10v10H11z" />
                    <path fill="#ffb900" d="M11 11h10v10H11z" />
                  </svg>
                  Continue with Microsoft
                </>
              )}
            </Button>
          </div>

          {/* Email Sign In - Temporarily disabled */}
          <div className="text-center text-sm text-zinc-500 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
            <Mail className="w-6 h-6 mx-auto mb-2 text-zinc-600" />
            <p>Email sign-in coming soon</p>
            <p className="text-xs mt-1">Use Google or Microsoft for now</p>
          </div>

          {/* Footer Links */}
          <div className="text-center text-xs text-zinc-500 space-y-2 pt-4">
            <p>
              By signing in, you agree to our{" "}
              <Link href="/terms" className="underline hover:text-white">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline hover:text-white">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        {/* Admin Link */}
        <div className="text-center text-sm text-zinc-500">
          Are you an admin?{" "}
          <Link href="/start" className="text-white underline hover:no-underline">
            Go to admin login
          </Link>
        </div>
      </div>
    </div>
  )
}
