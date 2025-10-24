import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/student/login">← Back to Login</Link>
          </Button>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-muted-foreground mt-2">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using Wathefni AI, you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Use License</h2>
            <p>
              Permission is granted to temporarily use Wathefni AI for personal, non-commercial transitory viewing only.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Usage</h2>
            <p>
              Your CV and personal information are processed for career matching and job recommendation purposes. 
              Data is retained for 12 months and accessible only to authorized staff.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Privacy</h2>
            <p>
              Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Contact Information</h2>
            <p>
              If you have any questions about these Terms of Service, please contact support@careerly.com.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
