"use client"

import { signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, FileText, Building2, Calendar, Download, RefreshCw, Trash2 } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import { useState } from "react"

interface Submission {
  id: string
  name: string
  email: string
  phone: string
  cv_file_key: string
  created_at: string
  parse_status: string
  knet_profile: any
  org_name: string
  org_slug: string
  org_logo: string | null
}

interface StudentDashboardProps {
  session: any
  submissions: Submission[]
}

export default function StudentDashboard({ session, submissions }: StudentDashboardProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this submission?")) return

    setIsDeleting(id)
    try {
      const res = await fetch(`/api/student/submissions/${id}`, {
        method: "DELETE",
      })

      if (!res.ok) throw new Error("Failed to delete")

      toast.success("Submission deleted successfully")
      window.location.reload()
    } catch (error) {
      toast.error("Failed to delete submission")
    } finally {
      setIsDeleting(null)
    }
  }

  const handleResubmit = (orgSlug: string) => {
    window.location.href = `/${orgSlug}/start`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500"
      case "processing":
        return "text-yellow-500"
      case "failed":
        return "text-red-500"
      default:
        return "text-zinc-500"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Parsed"
      case "processing":
        return "Processing"
      case "failed":
        return "Failed"
      default:
        return "Pending"
    }
  }

  // Group submissions by organization
  const groupedSubmissions = submissions.reduce((acc, submission) => {
    if (!acc[submission.org_slug]) {
      acc[submission.org_slug] = {
        name: submission.org_name,
        logo: submission.org_logo,
        submissions: [],
      }
    }
    acc[submission.org_slug].submissions.push(submission)
    return acc
  }, {} as Record<string, { name: string; logo: string | null; submissions: Submission[] }>)

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Student Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session.user?.image} />
                <AvatarFallback>
                  {session.user?.name?.[0] || session.user?.email?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-medium">{session.user?.name}</p>
                <p className="text-xs text-zinc-400">{session.user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/student/login" })}
              className="text-zinc-400 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Actions */}
        <div className="mb-8 flex gap-4">
          <Link href="/upload">
            <Button className="bg-white text-black hover:bg-gray-100">
              <FileText className="w-4 h-4 mr-2" />
              New Submission
            </Button>
          </Link>
          <Link href="/ai-builder">
            <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
              Build CV with AI
            </Button>
          </Link>
        </div>

        {/* Submissions */}
        {submissions.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800 p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-zinc-600" />
            <h2 className="text-xl font-semibold mb-2">No submissions yet</h2>
            <p className="text-zinc-400 mb-6">
              Start by uploading your CV or building one with AI
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/upload">
                <Button className="bg-white text-black hover:bg-gray-100">
                  Upload CV
                </Button>
              </Link>
              <Link href="/ai-builder">
                <Button variant="outline" className="border-zinc-700 text-white hover:bg-zinc-800">
                  Build with AI
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedSubmissions).map(([orgSlug, orgData]) => (
              <div key={orgSlug}>
                {/* Organization Header */}
                <div className="flex items-center gap-3 mb-4">
                  {orgData.logo ? (
                    <Image
                      src={orgData.logo}
                      alt={orgData.name}
                      width={32}
                      height={32}
                      className="rounded"
                    />
                  ) : (
                    <Building2 className="w-8 h-8 text-zinc-500" />
                  )}
                  <h2 className="text-lg font-semibold">{orgData.name}</h2>
                  <span className="text-xs text-zinc-500">
                    ({orgData.submissions.length} submission{orgData.submissions.length !== 1 ? "s" : ""})
                  </span>
                </div>

                {/* Submissions for this org */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {orgData.submissions.map((submission) => (
                    <Card key={submission.id} className="bg-zinc-900 border-zinc-800 p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold">{submission.name}</h3>
                          <p className="text-sm text-zinc-400">{submission.email}</p>
                        </div>
                        <span className={`text-sm font-medium ${getStatusColor(submission.parse_status)}`}>
                          {getStatusLabel(submission.parse_status)}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(submission.created_at), "PPp")}
                        </div>
                        {submission.knet_profile && (
                          <div className="text-sm text-zinc-400">
                            {submission.knet_profile.degree} • {submission.knet_profile.yearsOfExperience}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {submission.cv_file_key && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                            onClick={() => window.open(`/api/cv/download/${submission.cv_file_key}`, "_blank")}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
                          onClick={() => handleResubmit(orgSlug)}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-700 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          onClick={() => handleDelete(submission.id)}
                          disabled={isDeleting === submission.id}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
