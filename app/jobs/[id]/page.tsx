"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Building2, MapPin, DollarSign, Clock, Briefcase, 
  CheckCircle, ArrowLeft
} from 'lucide-react'
import { Space_Grotesk } from 'next/font/google'
import { useLanguage } from '@/lib/language'

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
  requirements?: string
  responsibilities?: string
  benefits?: string
  skills?: string[]
  created_at: string
  company_name: string
  company_slug: string
  company_logo?: string
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const { t } = useLanguage()
  const router = useRouter()
  const jobId = params.id
  
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [showApplyDialog, setShowApplyDialog] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)
  
  const [applicationData, setApplicationData] = useState({
    candidate_email: '',
    cover_letter: ''
  })
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchJob()
  }, [])

  const fetchJob = async () => {
    try {
      // Try to get company slug from URL or job data
      const res = await fetch(`/api/jobs/public`)
      if (res.ok) {
        const data = await res.json()
        const foundJob = data.jobs.find((j: any) => j.id === jobId)
        if (foundJob) {
          setJob(foundJob)
          // Check if user has applied (if they have an email in localStorage)
          const savedEmail = localStorage.getItem('candidate_email')
          if (savedEmail) {
            checkApplicationStatus(foundJob.company_slug, savedEmail)
          }
        }
      }
    } catch (error) {
      console.error('Failed to load job:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkApplicationStatus = async (companySlug: string, email: string) => {
    try {
      const res = await fetch(`/api/${companySlug}/jobs/${jobId}/apply?email=${encodeURIComponent(email)}`)
      if (res.ok) {
        const data = await res.json()
        setHasApplied(data.applied)
      }
    } catch (error) {
      console.error('Failed to check application status:', error)
    }
  }

  const handleApply = async () => {
    if (!job) return
    
    // Check if user has email saved
    const savedEmail = localStorage.getItem('candidate_email')
    
    if (savedEmail) {
      // Check if they have a CV uploaded for this organization
      try {
        const checkRes = await fetch(
          `/api/${job.company_slug}/candidates/check?email=${encodeURIComponent(savedEmail)}`
        )
        
        if (checkRes.ok) {
          const { exists } = await checkRes.json()
          
          if (!exists) {
            // No CV found! Redirect to choice page
            // Store job info to return after upload
            localStorage.setItem('return_to_job', JSON.stringify({
              jobId: job.id,
              jobTitle: job.title,
              company: job.company_name
            }))
            
            // Redirect to CV choice page
            router.push(`/${job.company_slug}/cv-choice`)
            return
          }
        }
      } catch (error) {
        console.error('Failed to check CV:', error)
      }
      
      // CV exists or check failed - proceed with application
      setApplicationData(prev => ({ ...prev, candidate_email: savedEmail }))
    }
    
    setShowApplyDialog(true)
  }

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setApplying(true)

    try {
      if (!job) return

      const res = await fetch(`/api/${job.company_slug}/jobs/${jobId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationData)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application')
      }

      // Save email for future applications
      localStorage.setItem('candidate_email', applicationData.candidate_email)
      
      setSuccess(true)
      setHasApplied(true)
      setTimeout(() => {
        setShowApplyDialog(false)
        setSuccess(false)
      }, 2000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setApplying(false)
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

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays} days ago`
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`
    return `${Math.floor(diffInDays / 30)} months ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>{t('loading_job')}</p>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive mb-4">{t('job_not_found')}</p>
            <Button onClick={() => router.push('/jobs')}>
              {t('back_to_jobs')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={`${spaceGrotesk.className} min-h-screen bg-[#eeeee4]`}>
      {/* Header */}
      <div className="bg-white border-b-[3px] border-black">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/jobs')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('back_to_jobs')}
          </Button>

          <div className="flex items-start gap-4 mb-6">
            {job.company_logo ? (
              <img 
                src={job.company_logo} 
                alt={job.company_name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                {job.company_name[0]}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
              <p className="text-lg text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                {job.company_name}
              </p>
            </div>
            {hasApplied ? (
              <Button disabled size="lg" className="rounded-2xl border-[2px] border-black bg-green-500 text-white shadow-[4px_4px_0_#111]">
                <CheckCircle className="w-5 h-5 mr-2" />
                {t('you_have_applied')}
              </Button>
            ) : (
              <Button onClick={handleApply} size="lg" className="rounded-2xl border-[2px] border-black bg-[#ffd6a5] text-black shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-transform">
                {t('apply_now')}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {job.location}
              </span>
            )}
            {job.job_type && <Badge variant="secondary">{job.job_type}</Badge>}
            {job.work_mode && <Badge variant="outline">{job.work_mode}</Badge>}
            <span className="flex items-center gap-1">
              <DollarSign className="w-4 h-4" />
              {formatSalary()}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {t('posted')} {getRelativeTime(job.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>{t('job_description')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{job.description}</p>
          </CardContent>
        </Card>

        {/* Requirements */}
        {job.requirements && (
          <Card>
            <CardHeader>
              <CardTitle>{t('requirements')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{job.requirements}</p>
            </CardContent>
          </Card>
        )}

        {/* Responsibilities */}
        {job.responsibilities && (
          <Card>
            <CardHeader>
              <CardTitle>{t('responsibilities')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{job.responsibilities}</p>
            </CardContent>
          </Card>
        )}

        {/* Benefits */}
        {job.benefits && (
          <Card>
            <CardHeader>
              <CardTitle>{t('benefits')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{job.benefits}</p>
            </CardContent>
          </Card>
        )}

        {/* Skills */}
        {job.skills && job.skills.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t('required_skills')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-sm py-2 px-3">
                    {skill}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Apply Button (sticky on mobile) */}
        {!hasApplied && (
          <div className="sticky bottom-4">
            <Button onClick={handleApply} size="lg" className="w-full shadow-lg">
              {t('apply_for_job')}
            </Button>
          </div>
        )}
      </div>

      {/* Application Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('application_submitted')}</DialogTitle>
            <DialogDescription>
              {t('application_success_msg')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitApplication} className="space-y-4">
            {error && (
              <div className="rounded-lg border-[2px] border-red-500 bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {success && (
              <div className="rounded-lg border-[2px] border-green-500 bg-green-50 p-3">
                <p className="text-sm text-green-700">
                  {t('application_submitted')}
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="candidate_email">{t('your_email')} *</Label>
              <Input
                id="candidate_email"
                type="email"
                value={applicationData.candidate_email}
                onChange={(e) => setApplicationData(prev => ({
                  ...prev,
                  candidate_email: e.target.value
                }))}
                placeholder={t('your_email_placeholder')}
                required
                disabled={applying}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('make_sure_cv_uploaded')}
              </p>
            </div>

            <div>
              <Label htmlFor="cover_letter">{t('cover_letter')}</Label>
              <Textarea
                id="cover_letter"
                value={applicationData.cover_letter}
                onChange={(e) => setApplicationData(prev => ({ ...prev, cover_letter: e.target.value }))}
                placeholder={t('cover_letter_placeholder')}
                rows={6}
                disabled={applying}
              />
            </div>

            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={applying || success}
                className="flex-1"
              >
                {applying ? t('submitting') : t('submit_application')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowApplyDialog(false)}
                disabled={applying}
              >
                {t('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
