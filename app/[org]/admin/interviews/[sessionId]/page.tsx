"use client"

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import { InterviewResultsView } from '@/components/interviews/InterviewResultsView'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function InterviewDetailPage() {
  const params = useParams()
  const org = params?.org as string
  const sessionId = params?.sessionId as string

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto">
          <Link
            href={`/${org}/admin/interviews`}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Interviews
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <Suspense fallback={
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        }>
          <InterviewResultsView sessionId={sessionId} />
        </Suspense>
      </div>
    </div>
  )
}
