"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Sparkles, ArrowRight, Briefcase } from 'lucide-react'
import { Space_Grotesk } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] })

export default function CVChoicePage({ params }: { params: { org: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orgSlug = params.org
  
  const [jobInfo, setJobInfo] = useState<any>(null)

  useEffect(() => {
    // Check if user came from job application
    const returnToJobData = localStorage.getItem('return_to_job')
    if (returnToJobData) {
      try {
        const job = JSON.parse(returnToJobData)
        setJobInfo(job)
      } catch {}
    }
  }, [])

  const handleUploadChoice = () => {
    router.push(`/${orgSlug}/start?source=job-application`)
  }

  const handleAIChoice = () => {
    router.push(`/career/ai-builder?org=${orgSlug}`)
  }

  return (
    <div className={`${spaceGrotesk.className} min-h-screen bg-[#eeeee4] flex items-center justify-center px-4`}>
      <div className="max-w-4xl w-full">
        {/* Header */}
        {jobInfo && (
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-white border-[2px] border-black">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm font-semibold">Applying to {jobInfo.jobTitle}</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">You Need a CV to Apply</h1>
            <p className="text-lg text-neutral-600">
              Choose how you'd like to create your CV for {jobInfo.company}
            </p>
          </div>
        )}

        {!jobInfo && (
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Create Your CV</h1>
            <p className="text-lg text-neutral-600">
              Choose how you'd like to get started
            </p>
          </div>
        )}

        {/* Choice Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload CV Option */}
          <Card 
            className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] hover:-translate-y-1 hover:shadow-[8px_8px_0_#111] transition-all cursor-pointer group"
            onClick={handleUploadChoice}
          >
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white border-[3px] border-black flex items-center justify-center group-hover:bg-neutral-50 transition-colors">
                <Upload className="w-8 h-8 text-black" />
              </div>
              <CardTitle className="text-2xl">Upload Existing CV</CardTitle>
              <CardDescription className="text-base">
                Already have a CV ready?
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-left space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-200 border-[2px] border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="text-sm">Upload PDF or Word document</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-200 border-[2px] border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="text-sm">Quick and easy process</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-green-200 border-[2px] border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span className="text-sm">Apply immediately after upload</span>
                </li>
              </ul>
              <Button 
                className="w-full rounded-2xl border-[2px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100 transition-transform"
              >
                Upload CV
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* AI Builder Option */}
          <Card 
            className="rounded-2xl border-[3px] border-black bg-gradient-to-br from-[#ffd6a5] to-[#ffb366] shadow-[6px_6px_0_#111] hover:-translate-y-1 hover:shadow-[8px_8px_0_#111] transition-all cursor-pointer group relative overflow-hidden"
            onClick={handleAIChoice}
          >
            <div className="absolute top-2 right-2">
              <span className="px-3 py-1 rounded-full bg-white border-[2px] border-black text-xs font-bold">
                ✨ AI-Powered
              </span>
            </div>
            <CardHeader className="text-center pb-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white border-[3px] border-black flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-8 h-8 text-black" />
              </div>
              <CardTitle className="text-2xl">Build CV with AI</CardTitle>
              <CardDescription className="text-base text-neutral-800">
                Don't have a CV? Let AI help!
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-left space-y-3 mb-6">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white border-[2px] border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✨
                  </span>
                  <span className="text-sm font-medium">AI creates your CV in minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white border-[2px] border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✨
                  </span>
                  <span className="text-sm font-medium">Professional templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-white border-[2px] border-black flex items-center justify-center flex-shrink-0 mt-0.5">
                    ✨
                  </span>
                  <span className="text-sm font-medium">Tailored to the job you're applying for</span>
                </li>
              </ul>
              <Button 
                className="w-full rounded-2xl border-[2px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:scale-105 transition-all font-bold"
              >
                Build with AI
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Back to Jobs Link */}
        {jobInfo && (
          <div className="text-center mt-8">
            <Button
              variant="ghost"
              onClick={() => router.push(`/jobs/${jobInfo.jobId}`)}
              className="text-neutral-600 hover:text-black"
            >
              ← Back to job listing
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
