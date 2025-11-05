"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Play, Users, CheckCircle, Clock, AlertCircle, Video, FileText } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import InterviewTemplateManager from '@/components/admin/InterviewTemplateManager'

type Interview = {
  session_id: string
  status: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  template_title: string
  candidate_name: string
  candidate_email: string
  responses_count: number
  total_questions: number
  avg_score: number | null
}

export default function InterviewsPage() {
  const params = useParams()
  const router = useRouter()
  const org = params?.org as string
  
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!org) return

    const fetchInterviews = async () => {
      try {
        setLoading(true)
        const res = await fetch(`/api/${org}/admin/interviews`)
        
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
  }, [org])

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      expired: 'bg-gray-100 text-gray-800 border-gray-300'
    }
    
    const icons = {
      pending: <Clock className="w-3 h-3" />,
      in_progress: <Play className="w-3 h-3" />,
      completed: <CheckCircle className="w-3 h-3" />,
      expired: <AlertCircle className="w-3 h-3" />
    }
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${styles[status as keyof typeof styles] || styles.pending}`}>
        {icons[status as keyof typeof icons]}
        {status.replace('_', ' ')}
      </span>
    )
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score >= 80) return 'text-green-600 font-bold'
    if (score >= 60) return 'text-yellow-600 font-semibold'
    return 'text-red-600 font-semibold'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Video Interviews</h1>
        <p className="text-gray-600">Manage interview templates and review candidate responses</p>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="mb-6 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-2">
          <TabsTrigger value="templates" className="rounded-xl border-[3px] border-transparent data-[state=active]:border-black data-[state=active]:bg-[#bde0fe] data-[state=active]:shadow-[4px_4px_0_#111] font-bold">
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="results" className="rounded-xl border-[3px] border-transparent data-[state=active]:border-black data-[state=active]:bg-[#bde0fe] data-[state=active]:shadow-[4px_4px_0_#111] font-bold">
            <Video className="w-4 h-4 mr-2" />
            Interview Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <InterviewTemplateManager orgSlug={org} />
        </TabsContent>

        <TabsContent value="results">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>{interviews.length} Total Interview Sessions</span>
            </div>
          </div>

      {interviews.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No interviews yet</h3>
          <p className="text-gray-600">
            Video interviews will appear here once candidates complete them.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {interviews.map((interview) => (
            <div
              key={interview.session_id}
              onClick={() => router.push(`/${org}/admin/interviews/${interview.session_id}`)}
              className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {interview.candidate_name}
                  </h3>
                  <p className="text-sm text-gray-600">{interview.candidate_email}</p>
                </div>
                {getStatusBadge(interview.status)}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Interview Template</div>
                  <div className="text-sm font-medium text-gray-900">{interview.template_title}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 mb-1">Progress</div>
                  <div className="text-sm font-medium text-gray-900">
                    {interview.responses_count} / {interview.total_questions} questions
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">AI Score</div>
                  <div className={`text-sm ${getScoreColor(interview.avg_score)}`}>
                    {interview.avg_score !== null ? `${interview.avg_score}/100` : 'Not scored yet'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    {interview.completed_at ? 'Completed' : 'Created'}
                  </div>
                  <div className="text-sm text-gray-900">
                    {formatDate(interview.completed_at || interview.created_at)}
                  </div>
                </div>
              </div>

              {interview.responses_count > 0 && (
                <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                  <Play className="w-4 h-4" />
                  View Analysis & Video Responses
                </div>
              )}
            </div>
          ))}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
