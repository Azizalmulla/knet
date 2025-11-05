"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Video, Clock, CheckCircle, AlertCircle, Calendar, Building2, Play } from 'lucide-react'
import Link from 'next/link'

type Interview = {
  session_id: string
  status: string
  started_at: string | null
  completed_at: string | null
  expires_at: string | null
  created_at: string
  template_title: string
  template_description: string | null
  org_name: string
  org_slug: string
  responses_count: number
  total_questions: number
  avg_score: number | null
}

export default function StudentInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/student/interviews')
        
        if (!res.ok) {
          throw new Error('Failed to fetch interviews')
        }
        
        const data = await res.json()
        setInterviews(data.interviews || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load interviews')
      } finally {
        setLoading(false)
      }
    }

    fetchInterviews()
  }, [])

  const getStatusBadge = (status: string) => {
    const configs = {
      pending: { 
        icon: <Clock className="w-3 h-3" />, 
        className: 'bg-[#ffd6a5] text-black border-[2px] border-black',
        label: 'Pending'
      },
      in_progress: { 
        icon: <Play className="w-3 h-3" />, 
        className: 'bg-[#bde0fe] text-black border-[2px] border-black',
        label: 'In Progress'
      },
      completed: { 
        icon: <CheckCircle className="w-3 h-3" />, 
        className: 'bg-[#a7f3d0] text-black border-[2px] border-black',
        label: 'Completed'
      },
      expired: { 
        icon: <AlertCircle className="w-3 h-3" />, 
        className: 'bg-gray-200 text-gray-700 border-[2px] border-black',
        label: 'Expired'
      }
    }
    
    const config = configs[status as keyof typeof configs] || configs.pending
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl font-bold text-xs shadow-[3px_3px_0_#111] ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="animate-pulse rounded-2xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0_#111]">
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border-[3px] border-red-500 bg-red-50 p-6 shadow-[6px_6px_0_#111]">
        <p className="text-red-800 font-semibold">{error}</p>
      </div>
    )
  }

  if (interviews.length === 0) {
    return (
      <div className="rounded-2xl border-[3px] border-dashed border-black bg-white p-12 text-center shadow-[6px_6px_0_#111]">
        <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">No Interview Invitations</h3>
        <p className="text-gray-600">
          When companies invite you for video interviews, they will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {interviews.map((interview) => {
        const daysLeft = getDaysUntilExpiry(interview.expires_at)
        const isExpiringSoon = daysLeft !== null && daysLeft <= 3 && daysLeft > 0
        const isPending = interview.status === 'pending'
        const isInProgress = interview.status === 'in_progress'
        const canStart = isPending || isInProgress
        
        return (
          <div 
            key={interview.session_id}
            className={`rounded-2xl border-[3px] border-black p-6 transition-all hover:-translate-y-1 ${
              canStart ? 'bg-[#e0f2ff] shadow-[8px_8px_0_#111] hover:shadow-[10px_10px_0_#111]' : 'bg-white shadow-[6px_6px_0_#111] hover:shadow-[8px_8px_0_#111]'
            }`}
          >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">
                      {interview.template_title}
                    </h3>
                    {getStatusBadge(interview.status)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {interview.org_name}
                    </div>
                    <div className="flex items-center gap-1">
                      <Video className="w-4 h-4" />
                      {interview.total_questions} questions
                    </div>
                    {interview.expires_at && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Expires {formatDate(interview.expires_at)}
                      </div>
                    )}
                  </div>

                  {interview.template_description && (
                    <p className="text-sm text-gray-700 mb-3">
                      {interview.template_description}
                    </p>
                  )}

                  {/* Progress indicator */}
                  {interview.responses_count > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-600 font-semibold">Progress</span>
                        <span className="font-bold">
                          {interview.responses_count} / {interview.total_questions} completed
                        </span>
                      </div>
                      <div className="h-3 bg-gray-200 rounded-full overflow-hidden border-[2px] border-black">
                        <div 
                          className="h-full bg-[#bde0fe] transition-all"
                          style={{ width: `${(interview.responses_count / interview.total_questions) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expiring soon warning */}
                  {isExpiringSoon && canStart && (
                    <div className="flex items-center gap-2 text-sm rounded-xl border-[3px] border-black bg-[#ffd6a5] px-4 py-2 mb-3 shadow-[3px_3px_0_#111]">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-bold">
                        Expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}! Complete it soon.
                      </span>
                    </div>
                  )}

                  {/* Completed score */}
                  {interview.status === 'completed' && interview.avg_score !== null && (
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <span className="text-gray-600">Your Score:</span>
                      <span className={`text-lg font-bold ${
                        interview.avg_score >= 80 ? 'text-green-600' :
                        interview.avg_score >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {interview.avg_score}/100
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {canStart ? (
                  <Link href={`/interview/${interview.session_id}`}>
                    <Button className="rounded-2xl border-[3px] border-black bg-[#bde0fe] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] transition-all font-bold">
                      <Play className="w-4 h-4 mr-2" />
                      {isInProgress ? 'Continue Interview' : 'Start Interview'}
                    </Button>
                  </Link>
                ) : interview.status === 'completed' ? (
                  <Button className="rounded-2xl border-[3px] border-black bg-[#a7f3d0] text-black shadow-[4px_4px_0_#111] font-bold" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Completed
                  </Button>
                ) : (
                  <Button className="rounded-2xl border-[3px] border-black bg-gray-200 text-gray-600 shadow-[4px_4px_0_#111] font-bold" disabled>
                    Expired
                  </Button>
                )}
              </div>
          </div>
        )
      })}
    </div>
  )
}
