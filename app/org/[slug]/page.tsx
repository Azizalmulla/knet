import { createServerClient } from '@/lib/supabase-server'
import { sql } from '@vercel/postgres'
import { redirect, notFound } from 'next/navigation'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { FileUp, Sparkles, ArrowLeft } from "lucide-react"

export default async function OrganizationPage({ params }: { params: { slug: string } }) {
  // Check if user is authenticated
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user?.email) {
    redirect('/student/login')
  }
  
  // Fetch organization details
  let org = null
  try {
    const { rows } = await sql`
      SELECT 
        id,
        name,
        slug,
        is_public
      FROM organizations
      WHERE slug = ${params.slug}
      LIMIT 1;
    `
    if (rows.length > 0) {
      org = rows[0]
    }
  } catch (error) {
    console.error('Failed to load organization:', error)
  }
  
  if (!org) {
    notFound()
  }
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-6 flex items-center justify-between">
          <div>
            <Link href="/start">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Organizations
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">{org.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">Submit your CV to {org.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <form action="/api/auth/signout" method="POST">
              <Button type="submit" variant="ghost" size="sm">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How would you like to apply?</h2>
          <p className="text-muted-foreground">Choose your preferred method to submit your CV</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Upload CV Option */}
          <Link href={`/upload?org=${org.slug}`}>
            <Card className="p-8 hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileUp className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-xl mb-2">Upload CV</h3>
              <p className="text-muted-foreground text-sm">
                Already have a CV? Upload your PDF file and we'll process it.
              </p>
              <Button className="mt-6 w-full" variant="default">
                Upload PDF
              </Button>
            </Card>
          </Link>
          
          {/* Build CV Option */}
          <Link href={`/career/ai-builder?org=${org.slug}`}>
            <Card className="p-8 hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-semibold text-xl mb-2">Build CV with AI</h3>
              <p className="text-muted-foreground text-sm">
                Need a new CV? Use our AI-powered builder to create one.
              </p>
              <Button className="mt-6 w-full" variant="secondary">
                Start Building
              </Button>
            </Card>
          </Link>
        </div>
        
        <div className="mt-16 text-center">
          <Link href={`/student/dashboard?org=${org.slug}`}>
            <Button variant="outline">
              Open Career Dashboard
            </Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
