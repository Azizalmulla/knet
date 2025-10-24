"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Briefcase, MapPin, DollarSign, Clock, Users, Eye, 
  Edit, Trash2, XCircle, CheckCircle, Mail 
} from 'lucide-react'
import TopJobMatches from '@/components/admin/TopJobMatches'

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
  requirements?: string
  responsibilities?: string
  benefits?: string
  skills?: string[]
  status: string
  application_count: number
  view_count: number
  created_at: string
  company_name: string
}

interface Applicant {
  application_id: string
  application_status: string
  applied_at: string
  cover_letter?: string
  candidate_id: string
  full_name: string
  email: string
  phone?: string
  field_of_study?: string
  university?: string
  gpa?: number
  years_of_experience?: number
}

export default function JobDetailPage({ params }: { params: { org: string; id: string } }) {
  const router = useRouter()
  const { org: orgSlug, id: jobId } = params
  
  const [job, setJob] = useState<Job | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showApplicants, setShowApplicants] = useState(false)

  useEffect(() => {
    fetchJob()
  }, [])

  const fetchJob = async () => {
    try {
      const res = await fetch(`/api/${orgSlug}/jobs/${jobId}`)
      if (res.ok) {
        const data = await res.json()
        setJob(data.job)
      } else {
        setError('Job not found')
      }
    } catch (err) {
      setError('Failed to load job')
    } finally {
      setLoading(false)
    }
  }

  const fetchApplicants = async () => {
    try {
      const res = await fetch(`/api/${orgSlug}/jobs/${jobId}/applicants`)
      if (res.ok) {
        const data = await res.json()
        setApplicants(data.applicants || [])
        setShowApplicants(true)
      }
    } catch (err) {
      console.error('Failed to load applicants:', err)
    }
  }

  const handleCloseJob = async () => {
    if (!confirm('Close this job? It will no longer accept applications.')) return
    
    try {
      const res = await fetch(`/api/${orgSlug}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      })
      
      if (res.ok) {
        fetchJob() // Refresh
      }
    } catch (err) {
      alert('Failed to close job')
    }
  }

  const handleReopenJob = async () => {
    try {
      const res = await fetch(`/api/${orgSlug}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'open' })
      })
      
      if (res.ok) {
        fetchJob() // Refresh
      }
    } catch (err) {
      alert('Failed to reopen job')
    }
  }

  const handleDeleteJob = async () => {
    if (!confirm('Delete this job? This action cannot be undone.')) return
    
    try {
      const res = await fetch(`/api/${orgSlug}/jobs/${jobId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        router.push(`/${orgSlug}/admin/jobs`)
      } else {
        alert('Failed to delete job')
      }
    } catch (err) {
      alert('Failed to delete job')
    }
  }

  const formatSalary = () => {
    if (!job) return 'Not specified'
    const { salary_min, salary_max, salary_currency = 'KWD' } = job
    if (!salary_min && !salary_max) return 'Not specified'
    if (salary_min && salary_max) return `${salary_currency} ${salary_min} - ${salary_max}`
    if (salary_min) return `${salary_currency} ${salary_min}+`
    return `Up to ${salary_currency} ${salary_max}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading job...</p>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error || 'Job not found'}</p>
            <Button 
              className="mt-4" 
              onClick={() => router.push(`/${orgSlug}/admin/jobs`)}
            >
              Back to Jobs
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${orgSlug}/admin/jobs`)}
            >
              ← Back
            </Button>
            <Badge variant={job.status === 'open' ? 'default' : 'secondary'}>
              {job.status}
            </Badge>
          </div>
          <div className="flex gap-2">
            {job.status === 'open' ? (
              <Button variant="outline" size="sm" onClick={handleCloseJob}>
                <XCircle className="w-4 h-4 mr-2" />
                Close Job
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleReopenJob}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Reopen Job
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => router.push(`/${orgSlug}/admin/jobs/new`)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteJob}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Title & Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{job.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mt-2">
              {job.department && <span>{job.department}</span>}
              {job.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {job.location}
                </span>
              )}
              {job.job_type && <Badge variant="secondary">{job.job_type}</Badge>}
              {job.work_mode && <Badge variant="outline">{job.work_mode}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{job.application_count}</p>
                  <p className="text-xs text-muted-foreground">Applicants</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{job.view_count}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">{formatSalary()}</p>
                  <p className="text-xs text-muted-foreground">Salary</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold">
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Posted</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Top Matches */}
        <TopJobMatches orgSlug={orgSlug} jobId={jobId} />

        {/* Applicants Button */}
        {job.application_count > 0 && (
          <Button 
            onClick={fetchApplicants}
            className="w-full"
            size="lg"
          >
            <Users className="w-5 h-5 mr-2" />
            View {job.application_count} Applicant{job.application_count !== 1 ? 's' : ''}
          </Button>
        )}

        {/* Applicants List */}
        {showApplicants && applicants.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Applicants ({applicants.length})</CardTitle>
              <CardDescription>Candidates who applied to this position</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {applicants.map((applicant) => (
                  <div 
                    key={applicant.application_id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => router.push(`/${orgSlug}/admin?candidate=${applicant.candidate_id}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                          {applicant.full_name[0]}
                        </div>
                        <div>
                          <p className="font-semibold">{applicant.full_name}</p>
                          <p className="text-sm text-muted-foreground">{applicant.email}</p>
                        </div>
                      </div>
                      {applicant.field_of_study && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {applicant.field_of_study} • {applicant.university}
                          {applicant.gpa && ` • GPA: ${applicant.gpa}`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{applicant.application_status}</Badge>
                      <Button size="sm" variant="outline">
                        <Mail className="w-4 h-4 mr-1" />
                        Email
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Job Details */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{job.description}</p>
            </CardContent>
          </Card>

          {job.requirements && (
            <Card>
              <CardHeader>
                <CardTitle>Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{job.requirements}</p>
              </CardContent>
            </Card>
          )}

          {job.responsibilities && (
            <Card>
              <CardHeader>
                <CardTitle>Responsibilities</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{job.responsibilities}</p>
              </CardContent>
            </Card>
          )}

          {job.benefits && (
            <Card>
              <CardHeader>
                <CardTitle>Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{job.benefits}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Required Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">{skill}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
