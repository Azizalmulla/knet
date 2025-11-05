"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
        className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        label: 'Pending'
      },
      in_progress: { 
        icon: <Play className="w-3 h-3" />, 
        className: 'bg-blue-100 text-blue-800 border-blue-300',
        label: 'In Progress'
      },
      completed: { 
        icon: <CheckCircle className="w-3 h-3" />, 
        className: 'bg-green-100 text-green-800 border-green-300',
        label: 'Completed'
      },
      expired: { 
        icon: <AlertCircle className="w-3 h-3" />, 
        className: 'bg-gray-100 text-gray-800 border-gray-300',
        label: 'Expired'
      }
    }
    
    const config = configs[status as keyof typeof configs] || configs.pending
    
    return (
      <Badge className={`inline-flex items-center gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
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
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-red-800">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (interviews.length === 0) {
    return (
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="p-12 text-center">
          <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Interview Invitations</h3>
          <p className="text-gray-600">
            When companies invite you for video interviews, they will appear here.
          </p>
        </CardContent>
      </Card>
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
          <Card 
            key={interview.session_id}
            className={`border-2 transition-all hover:shadow-lg ${
              canStart ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200'
            }`}
          >
            <CardContent className="p-6">
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
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">
                          {interview.responses_count} / {interview.total_questions} completed
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 transition-all"
                          style={{ width: `${(interview.responses_count / interview.total_questions) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expiring soon warning */}
                  {isExpiringSoon && canStart && (
                    <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-100 border border-orange-300 rounded-lg px-3 py-2 mb-3">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">
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
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Play className="w-4 h-4 mr-2" />
                      {isInProgress ? 'Continue Interview' : 'Start Interview'}
                    </Button>
                  </Link>
                ) : interview.status === 'completed' ? (
                  <Button variant="outline" disabled>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Completed
                  </Button>
                ) : (
                  <Button variant="outline" disabled>
                    Expired
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
