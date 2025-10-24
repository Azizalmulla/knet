"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Briefcase, MapPin, DollarSign, Building2, Clock, Search } from 'lucide-react'
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
  skills?: string[]
  application_count: number
  created_at: string
  company_name: string
  company_slug: string
  company_logo?: string
}

function JobsPageContent() {
  const { t } = useLanguage()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [locationFilter, setLocationFilter] = useState(searchParams.get('location') || '')
  const [jobTypeFilter, setJobTypeFilter] = useState(searchParams.get('job_type') || '')
  const [workModeFilter, setWorkModeFilter] = useState(searchParams.get('work_mode') || '')

  useEffect(() => {
    fetchJobs()
  }, [searchTerm, locationFilter, jobTypeFilter, workModeFilter])

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (locationFilter) params.append('location', locationFilter)
      if (jobTypeFilter && jobTypeFilter !== 'all') params.append('job_type', jobTypeFilter)
      if (workModeFilter && workModeFilter !== 'all') params.append('work_mode', workModeFilter)

      const res = await fetch(`/api/jobs/public?${params.toString()}`)
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
    if (!job.salary_min && !job.salary_max) return t('salary_not_specified')
    const currency = job.salary_currency || 'KWD'
    if (job.salary_min && job.salary_max) {
      return `${currency} ${job.salary_min} - ${job.salary_max}`
    }
    if (job.salary_min) return `${currency} ${job.salary_min}+`
    return `${t('up_to')} ${currency} ${job.salary_max}`
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return t('today')
    if (diffInDays === 1) return t('yesterday')
    if (diffInDays < 7) return t('days_ago', { count: diffInDays })
    if (diffInDays < 30) return t('weeks_ago', { count: Math.floor(diffInDays / 7) })
    return t('months_ago', { count: Math.floor(diffInDays / 30) })
  }

  return (
    <div className={`${spaceGrotesk.className} min-h-screen bg-[#eeeee4]`}>
      {/* Header */}
      <div className="bg-white border-b-[3px] border-black">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 inline-block border-b-[4px] border-black pb-2">
              {t('find_next_opportunity')}
            </h1>
            <p className="text-lg text-neutral-600 mt-4">
              {t('browse_latest_openings', { count: jobs.length })}
            </p>
          </div>

          {/* Search & Filters */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('search_jobs_by_title_or_keywords')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Input
              placeholder={t('location')}
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            />
            <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t('job_type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all_types')}</SelectItem>
                <SelectItem value="full-time">{t('full_time')}</SelectItem>
                <SelectItem value="part-time">{t('part_time')}</SelectItem>
                <SelectItem value="contract">{t('contract')}</SelectItem>
                <SelectItem value="internship">{t('internship')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('loading_jobs')}</p>
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">{t('no_jobs_found')}</h3>
              <p className="text-muted-foreground">{t('try_different_filters')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {jobs.map((job) => (
              <div 
                key={job.id}
                className="rounded-2xl border-[3px] border-black bg-white p-6 shadow-[6px_6px_0_#111] hover:-translate-y-1 hover:shadow-[8px_8px_0_#111] transition-all cursor-pointer"
                onClick={() => router.push(`/jobs/${job.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {job.company_logo ? (
                        <img 
                          src={job.company_logo} 
                          alt={job.company_name}
                          className="w-12 h-12 rounded-xl border-[2px] border-black object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#ffd6a5] border-[2px] border-black flex items-center justify-center text-black font-bold text-xl">
                          {job.company_name[0]}
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold mb-1">{job.title}</h3>
                        <p className="text-sm text-neutral-600 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {job.company_name}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 mb-3">
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
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {formatSalary(job)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getRelativeTime(job.created_at)}
                      </span>
                    </div>

                    <p className="line-clamp-2 text-neutral-600 text-sm">
                      {job.description}
                    </p>

                    {job.skills && job.skills.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {job.skills.slice(0, 5).map((skill) => (
                          <span key={skill} className="px-3 py-1 rounded-full bg-neutral-100 border-[2px] border-black text-xs font-semibold">
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 5 && (
                          <span className="px-3 py-1 rounded-full bg-neutral-100 border-[2px] border-black text-xs font-semibold">
                            +{job.skills.length - 5} {t('more')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Button className="rounded-2xl border-[2px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100 transition-transform">
                    {t('apply_now')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#eeeee4] flex items-center justify-center">
        <p className="text-lg">Loading jobs...</p>
      </div>
    }>
      <JobsPageContent />
    </Suspense>
  )
}
