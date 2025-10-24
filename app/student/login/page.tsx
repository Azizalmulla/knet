"use client"

import { useState, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Loader2 } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase-client"

function StudentLoginContent() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const redirectTo = searchParams.get("redirectTo") || "/start"
  const error = searchParams.get("error")

  // Show error toast if there's an error
  if (error) {
    toast.error(
      error === "access_denied"
        ? "Access was denied. Please try again."
        : "An error occurred during sign in"
    )
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    setProvider("email")
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (error) {
        toast.error("Failed to send magic link: " + error.message)
      } else {
        toast.success("Check your email for a sign-in link!")
        setEmail("")
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
      setProvider(null)
    }
  }

  const handleOAuthSignIn = async (providerName: 'google' | 'azure') => {
    setProvider(providerName)
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: providerName,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?redirectTo=${encodeURIComponent(redirectTo)}`,
        },
      })

      if (error) {
        toast.error("Failed to sign in: " + error.message)
        setProvider(null)
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
      setProvider(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#eeeee4] text-neutral-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 text-black">Welcome to Wathefni AI</h1>
          <p className="text-neutral-600">Sign in to manage your applications</p>
        </div>

        {/* Sign in Card */}
        <div className="relative rounded-[28px] border-[4px] border-black bg-white p-6 md:p-8 space-y-6 shadow-[8px_8px_0_#111]">
          {/* OAuth Providers */}
          <div className="space-y-3">
            <Button
              className="w-full h-12 bg-white text-black font-semibold rounded-2xl border-[3px] border-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform disabled:opacity-60"
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
              className="w-full h-12 bg-[#0078D4] hover:bg-[#106EBE] text-white font-semibold rounded-2xl border-[3px] border-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 transition-transform disabled:opacity-60"
              onClick={() => handleOAuthSignIn("azure")}
              disabled={isLoading}
            >
              {provider === "azure" ? (
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

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-neutral-600">Or continue with</span>
            </div>
          </div>

          {/* Email Sign In */}
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-12 bg-white border-[3px] border-black text-black placeholder:text-neutral-500 rounded-2xl"
              required
            />
            <Button
              type="submit"
              className="w-full h-12 bg-white text-black font-semibold rounded-2xl border-[3px] border-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform disabled:opacity-60"
              disabled={isLoading || !email}
            >
              {provider === "email" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send Magic Link
                </>
              )}
            </Button>
          </form>

          {/* Footer Links */}
          <div className="text-center text-xs text-neutral-500 space-y-2 pt-4">
            <p>
              By signing in, you agree to our{" "}
              <Link href="/terms" className="underline decoration-[3px] decoration-black hover:text-black">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline decoration-[3px] decoration-black hover:text-black">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        {/* Admin Link */}
        <div className="text-center text-sm text-neutral-600">
          Are you an admin?{" "}
          <Link href="/start" className="text-black underline decoration-[3px] decoration-black hover:no-underline">
            Go to admin login
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function StudentLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#eeeee4] text-neutral-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    }>
      <StudentLoginContent />
    </Suspense>
  )
}
