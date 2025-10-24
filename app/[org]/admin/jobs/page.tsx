"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Briefcase, Plus, Users, Eye, MapPin, Clock, DollarSign } from 'lucide-react'
import { Space_Grotesk } from 'next/font/google'

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] })

interface Job {
  id: string
  title: string
  department?: string
  location?: string
  job_type?: string
  work_mode?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  description: string
  status: string
  application_count: number
  view_count: number
  created_at: string
}

export default function AdminJobsPage({ params }: { params: { org: string } }) {
  const router = useRouter()
  const orgSlug = params.org
  
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')

  useEffect(() => {
    fetchJobs()
  }, [filter])

  const fetchJobs = async () => {
    try {
      const res = await fetch(`/api/${orgSlug}/jobs?status=${filter}`)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatSalary = (job: Job) => {
    if (!job.salary_min && !job.salary_max) return 'Not specified'
    const currency = job.salary_currency || 'KWD'
    if (job.salary_min && job.salary_max) {
      return `${currency} ${job.salary_min} - ${job.salary_max}`
    }
    if (job.salary_min) return `${currency} ${job.salary_min}+`
    return `Up to ${currency} ${job.salary_max}`
  }

  return (
    <div className={`${spaceGrotesk.className} min-h-screen bg-[#eeeee4]`}>
      {/* Header */}
      <div className="border-b-[3px] border-black bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${orgSlug}/admin`)}
            >
              ← Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 border-b-[3px] border-black pb-1">
                <Briefcase className="w-6 h-6" />
                Job Openings
              </h1>
              <p className="text-sm text-neutral-600 mt-2">
                Post and manage job listings
              </p>
            </div>
          </div>
          <Button 
            onClick={() => router.push(`/${orgSlug}/admin/jobs/new`)}
            className="rounded-2xl border-[2px] border-black bg-[#ffd6a5] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-[#ffd6a5]/90 transition-transform"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post New Job
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex gap-2 mb-6">
          {['open', 'closed', 'filled', 'all'].map((status) => (
            <Button
              key={status}
              variant={filter === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>

        {/* Jobs List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading jobs...</p>
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
              <p className="text-muted-foreground mb-4">
                {filter === 'open' 
                  ? 'Get started by posting your first job opening'
                  : `No ${filter} jobs at the moment`
                }
              </p>
              {filter === 'open' && (
                <Button onClick={() => router.push(`/${orgSlug}/admin/jobs/new`)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Post New Job
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {jobs.map((job) => (
              <div 
                key={job.id} 
                className="rounded-2xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0_#111] hover:-translate-y-1 hover:shadow-[8px_8px_0_#111] cursor-pointer transition-all"
                onClick={() => router.push(`/${orgSlug}/admin/jobs/${job.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">{job.title}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                        {job.department && (
                          <span>{job.department}</span>
                        )}
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.location}
                          </span>
                        )}
                        {job.job_type && (
                          <Badge variant="secondary">{job.job_type}</Badge>
                        )}
                        {job.work_mode && (
                          <Badge variant="outline">{job.work_mode}</Badge>
                        )}
                      </div>
                    </div>
                  <span 
                    className={`px-3 py-1 rounded-full border-[2px] border-black text-xs font-semibold ${
                      job.status === 'open' ? 'bg-green-200' : 
                      job.status === 'filled' ? 'bg-blue-200' : 
                      'bg-neutral-200'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm text-neutral-600">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span className="font-semibold">{job.application_count} applicants</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>{job.view_count} views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{formatSalary(job)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>Posted {new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
