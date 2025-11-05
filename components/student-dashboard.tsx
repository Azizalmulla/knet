"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogOut, FileText, Building2, Calendar, Download, RefreshCw, Trash2, ChevronRight, ChevronDown, Home, Briefcase, Video } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { toast } from "sonner"
import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase-client"
import StudentInterviews from "@/components/StudentInterviews"

// Helper: get initials for avatar fallback (e.g., "Zain Kuwait" -> "ZK")
const getInitials = (name?: string) => {
  const n = (name || '').trim()
  if (!n) return '?'
  const parts = n.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : ''
  return (first + last).toUpperCase()
}

interface Submission {
  id: string
  name: string
  email: string
  phone: string
  cv_file_key: string
  created_at: string
  parse_status: string
  cv_type?: string
  ai_feedback?: string
  decision_status?: string
  knet_profile: any
  org_name: string
  org_slug: string
  org_logo: string | null
}

interface StudentDashboardProps {
  email: string
  submissions?: Submission[]
  submissionsAll?: Submission[]
  selectedOrgSlug?: string
  selectedOrgName?: string
  selectedOrgLogo?: string | null
}

export default function StudentDashboard({ email, submissions = [], submissionsAll = [], selectedOrgSlug, selectedOrgName }: StudentDashboardProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  const supabase = createClient()

  // View mode: 'selected' (default) or 'all'
  const [viewMode, setViewMode] = useState<'selected' | 'all'>(() => {
    const defaultMode: 'selected' | 'all' = (typeof selectedOrgSlug === 'string' && selectedOrgSlug) ? 'selected' : 'all'
    if (typeof window === 'undefined') return defaultMode
    const saved = window.localStorage.getItem('student_view_mode')
    const parsed = (saved === 'all' || saved === 'selected') ? (saved as 'selected' | 'all') : defaultMode
    return (parsed === 'selected' && !selectedOrgSlug) ? 'all' : parsed
  })

  // Persist view mode and send lightweight telemetry
  useEffect(() => {
    try { window.localStorage.setItem('student_view_mode', viewMode) } catch {}
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'student_view_mode_changed', mode: viewMode, org_slug: selectedOrgSlug || null })
      }).catch(() => {})
    } catch {}
  }, [viewMode, selectedOrgSlug])

  // Guard: if user is in Selected view without an org, switch to All
  useEffect(() => {
    if (viewMode === 'selected' && !selectedOrgSlug) {
      setViewMode('all')
      try { toast.info('No organization selected. Showing All.') } catch {}
    }
  }, [viewMode, selectedOrgSlug])

  // Local datasets for pagination (start with SSR props)
  const [dataSelected, setDataSelected] = useState<Submission[]>(submissions)
  const [dataAll, setDataAll] = useState<Submission[]>(submissionsAll)
  useEffect(() => { setDataSelected(submissions) }, [submissions])
  useEffect(() => { setDataAll(submissionsAll) }, [submissionsAll])

  // Optimistic add: if Upload page stashed a recent submission, inject it if missing
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('recent_submission_candidate')
      if (!raw) return
      const recent = JSON.parse(raw)
      // Basic sanity: within last 90 seconds and same user
      if (!recent || !recent.id || !recent.email) return
      if (recent._ts && Date.now() - Number(recent._ts) > 90_000) {
        window.localStorage.removeItem('recent_submission_candidate')
        return
      }
      if ((recent.email || '').toLowerCase() !== (email || '').toLowerCase()) {
        window.localStorage.removeItem('recent_submission_candidate')
        return
      }
      const toSubmission: Submission = {
        id: String(recent.id),
        name: String(recent.full_name || ''),
        email: String(recent.email || email),
        phone: String(recent.phone || ''),
        cv_file_key: String(recent.cv_file_key || ''),
        created_at: recent.created_at ? String(recent.created_at) : new Date().toISOString(),
        parse_status: String(recent.parse_status || 'pending'),
        cv_type: recent.cv_type ? String(recent.cv_type) : undefined,
        ai_feedback: '',
        decision_status: 'pending',
        knet_profile: {},
        org_name: String(recent.org_slug || 'Selected org'),
        org_slug: String(recent.org_slug || selectedOrgSlug || ''),
        org_logo: null,
      }

      // Selected view: only append if org matches; otherwise inform user
      if (viewMode === 'selected') {
        if (selectedOrgSlug && toSubmission.org_slug === selectedOrgSlug) {
          const exists = dataSelected.some(s => s.id === toSubmission.id)
          if (!exists) {
            setDataSelected(prev => [toSubmission, ...prev])
            toast.success('Added your latest submission')
          }
          window.localStorage.removeItem('recent_submission_candidate')
        } else if (selectedOrgSlug) {
          toast.info(`Your latest submission is for ${toSubmission.org_slug}. Switch to that org or All to view it.`)
          window.localStorage.removeItem('recent_submission_candidate')
        }
      } else {
        // All orgs: append if missing
        const exists = dataAll.some(s => s.id === toSubmission.id)
        if (!exists) {
          setDataAll(prev => [toSubmission, ...prev])
          toast.success('Added your latest submission')
        }
        window.localStorage.removeItem('recent_submission_candidate')
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedOrgSlug])

  // Pagination state
  const [offsetSelected, setOffsetSelected] = useState<number>(submissions.length)
  const [offsetAll, setOffsetAll] = useState<number>(submissionsAll.length)
  useEffect(() => { setOffsetSelected(submissions.length) }, [submissions])
  useEffect(() => { setOffsetAll(submissionsAll.length) }, [submissionsAll])
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreSelected, setHasMoreSelected] = useState(true)
  const [hasMoreAll, setHasMoreAll] = useState(true)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Client filters - default to showing all
  const [search, setSearch] = useState('')
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all') // Show all statuses by default
  const [cvTypeFilter, setCvTypeFilter] = useState<string>('all') // Show all CV types by default
  const [decisionFilter, setDecisionFilter] = useState<string>('all') // Show all decisions by default
  const [startDate, setStartDate] = useState<string>('') // No date filter by default
  const [endDate, setEndDate] = useState<string>('')     // No date filter by default
  const [newestFirst, setNewestFirst] = useState<boolean>(true) // Newest at the top
  const [layoutMode, setLayoutMode] = useState<'grouped' | 'timeline'>(() => {
    if (typeof window === 'undefined') return 'grouped'
    const saved = window.localStorage.getItem('student_layout_mode')
    return (saved === 'timeline' || saved === 'grouped') ? (saved as 'grouped'|'timeline') : 'grouped'
  })
  const [collapsedOrgs, setCollapsedOrgs] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = window.localStorage.getItem('student_collapsed_orgs')
      const arr = raw ? JSON.parse(raw) as string[] : []
      return new Set(arr)
    } catch { return new Set() }
  })

  // Don't persist filters that might hide new submissions - removed filter persistence

  // Persist org filter in All Orgs view
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (viewMode === 'all') {
        const saved = window.localStorage.getItem('student_org_filter')
        if (saved && (saved === 'all' || orgOptions.some(([slug]) => slug === saved))) {
          setOrgFilter(saved)
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { if (viewMode === 'all') window.localStorage.setItem('student_org_filter', orgFilter) } catch {}
  }, [orgFilter, viewMode])
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.localStorage.setItem('student_layout_mode', layoutMode) } catch {}
  }, [layoutMode])
  const persistCollapsed = (next: Set<string>) => {
    try { window.localStorage.setItem('student_collapsed_orgs', JSON.stringify(Array.from(next))) } catch {}
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch {}
    window.location.href = "/student/login"
  }

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

  // Load more helper (respects current filters)
  // Debug logging for fetches
  const fetchWithDebug = async (url: string, options?: RequestInit) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[DASHBOARD] Fetching:', url)
    }
    const res = await fetch(url, options)
    if (process.env.NODE_ENV === 'development') {
      const listCount = res.headers.get('X-List-Count')
      console.log('[DASHBOARD] Response:', { 
        status: res.status, 
        listCount,
        url 
      })
    }
    return res
  }
  const loadMore = async () => {
    if (loadingMore) return
    setLoadingMore(true)
    try {
      const limit = 30
      if (viewMode === 'all') {
        const qs = buildQuery('all', offsetAll, limit)
        const res = await fetchWithDebug(`/api/student/submissions/list?${qs}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({ submissions: [] }))
        const rows: Submission[] = Array.isArray(json?.submissions) ? json.submissions : []
        if (rows.length > 0) {
          setDataAll(prev => prev.concat(rows))
          setOffsetAll(prev => prev + rows.length)
          if (rows.length < limit) setHasMoreAll(false)
        } else {
          setHasMoreAll(false)
        }
      } else {
        const qs = buildQuery('selected', offsetSelected, limit)
        const res = await fetchWithDebug(`/api/student/submissions/list?${qs}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({ submissions: [] }))
        const rows: Submission[] = Array.isArray(json?.submissions) ? json.submissions : []
        if (rows.length > 0) {
          setDataSelected(prev => prev.concat(rows))
          setOffsetSelected(prev => prev + rows.length)
          if (rows.length < limit) setHasMoreSelected(false)
        } else {
          setHasMoreSelected(false)
        }
      }
    } finally {
      setLoadingMore(false)
    }
  }

  // Infinite scroll for Timeline (All orgs)
  useEffect(() => {
    if (viewMode !== 'all' || layoutMode !== 'timeline') return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && hasMoreAll && !loadingMore) {
          loadMore()
        }
      }
    }, { root: null, rootMargin: '0px', threshold: 1.0 })
    obs.observe(el)
    return () => { obs.disconnect() }
  }, [viewMode, layoutMode, hasMoreAll, loadingMore])

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

  const getStatusChipClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      case 'processing':
        return 'bg-amber-100 text-amber-800 border border-amber-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border border-red-200'
      default:
        return 'bg-zinc-100 text-zinc-800 border border-zinc-200'
    }
  }

  const getCvTypeLabel = (t?: string) => {
    if (!t) return null
    const v = (t || '').toLowerCase()
    if (v === 'ai' || v === 'ai_generated') return 'AI'
    if (v === 'uploaded') return 'Uploaded'
    return null
  }

  const getDecisionLabel = (d?: string) => {
    const v = (d || '').toLowerCase()
    if (!v) return 'Pending'
    return v.charAt(0).toUpperCase() + v.slice(1)
  }
  const getDecisionChipClass = (d?: string) => {
    const v = (d || 'pending').toLowerCase()
    switch (v) {
      case 'rejected':
        return 'bg-red-100 text-red-800 border border-red-200'
      case 'shortlisted':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200'
      case 'interviewed':
        return 'bg-blue-100 text-blue-800 border border-blue-200'
      case 'hired':
        return 'bg-purple-100 text-purple-800 border border-purple-200'
      default:
        return 'bg-zinc-100 text-zinc-800 border border-zinc-200'
    }
  }

  // Build query string for API based on filters
  const buildQuery = (mode: 'all' | 'selected', offset: number, limit: number) => {
    const params = new URLSearchParams()
    const effectiveMode: 'all' | 'selected' = (mode === 'selected' && !selectedOrgSlug) ? 'all' : mode
    params.set('mode', effectiveMode)
    params.set('offset', String(offset))
    params.set('limit', String(limit))
    const order = newestFirst ? 'desc' : 'asc'
    params.set('order', order)
    if (effectiveMode === 'selected') {
      if (selectedOrgSlug) params.set('org', selectedOrgSlug)
    } else {
      const org = (orgFilter && orgFilter !== 'all') ? orgFilter : ''
      if (org) params.set('org', org)
    }
    const s = statusFilter.toLowerCase()
    if (s && s !== 'all') params.set('status', s)
    const ct = cvTypeFilter.toLowerCase() === 'ai' ? 'ai' : cvTypeFilter.toLowerCase()
    if (ct && ct !== 'all') params.set('cvType', ct)
    const d = decisionFilter.toLowerCase()
    if (d && d !== 'all') params.set('decision', d)
    if (startDate) params.set('start', startDate)
    if (endDate) params.set('end', endDate)
    return params.toString()
  }

  // Refetch on filter changes (instant update, no full reload)
  useEffect(() => {
    let ignore = false
    const run = async () => {
      const limit = 30
      try {
        if (viewMode === 'all') {
          const qs = buildQuery('all', 0, limit)
          const res = await fetchWithDebug(`/api/student/submissions/list?${qs}`, { cache: 'no-store' })
          const json = await res.json().catch(() => ({ submissions: [] }))
          const rows: Submission[] = Array.isArray(json?.submissions) ? json.submissions : []
          if (!ignore) {
            setDataAll(rows)
            setOffsetAll(rows.length)
            setHasMoreAll(rows.length === limit)
          }
        } else {
          const qs = buildQuery('selected', 0, limit)
          const res = await fetchWithDebug(`/api/student/submissions/list?${qs}`, { cache: 'no-store' })
          const json = await res.json().catch(() => ({ submissions: [] }))
          const rows: Submission[] = Array.isArray(json?.submissions) ? json.submissions : []
          if (!ignore) {
            setDataSelected(rows)
            setOffsetSelected(rows.length)
            setHasMoreSelected(rows.length === limit)
          }
        }
      } catch {}
    }
    run()
    return () => { ignore = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, orgFilter, statusFilter, cvTypeFilter, decisionFilter, startDate, endDate, newestFirst, selectedOrgSlug])

  // Friendly toast if selected view has no submissions (likely wrong org)
  useEffect(() => {
    if (viewMode === 'selected' && selectedOrgSlug && dataSelected.length === 0) {
      try { toast.info('No submissions for this organization yet. If you just submitted to another org, switch to All or that org.') } catch {}
    }
  }, [viewMode, selectedOrgSlug, dataSelected.length])

  // Decide which dataset to show
  const baseSubmissions = (viewMode === 'all') ? dataAll : dataSelected

  // Build org options (only relevant in All orgs)
  const orgOptions = (viewMode === 'all')
    ? Array.from(new Map(baseSubmissions.map(s => [s.org_slug, s.org_name])).entries())
    : []

  // Apply filters
  const displayedSubmissions = baseSubmissions.filter(s => {
    if (viewMode === 'all' && orgFilter !== 'all' && orgFilter) {
      if (s.org_slug !== orgFilter) return false
    }
    if (statusFilter && statusFilter !== 'all') {
      const st = (s.parse_status || '').toLowerCase()
      if (st !== statusFilter) return false
    }
    if (cvTypeFilter && cvTypeFilter !== 'all') {
      const ct = (s.cv_type || '').toLowerCase()
      const want = cvTypeFilter === 'ai' ? 'ai' : cvTypeFilter
      if (!(ct === want || ct === (want === 'ai' ? 'ai_generated' : want))) return false
    }
    if (decisionFilter && decisionFilter !== 'all') {
      const ds = ((s as any).decision_status || (s as any)?.knet_profile?.decision_status || 'pending').toLowerCase()
      if (ds !== decisionFilter) return false
    }
    if (startDate) {
      if (new Date(s.created_at) < new Date(startDate + 'T00:00:00')) return false
    }
    if (endDate) {
      if (new Date(s.created_at) >= new Date(endDate + 'T23:59:59')) return false
    }
    if (search && search.trim()) {
      const q = search.toLowerCase()
      const hay = `${s.name} ${s.email} ${s.org_name}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // Timeline data (All orgs only)
  const timelineData = (viewMode === 'all')
    ? [...displayedSubmissions].sort((a, b) => (newestFirst
      ? (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      : (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())))
    : []

  // Group submissions by organization
  const groupedSubmissions = displayedSubmissions.reduce((acc, submission) => {
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
    <div className="min-h-screen bg-[#eeeee4] text-neutral-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b-[4px] border-black shadow-[8px_8px_0_#111]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Career Dashboard{viewMode === 'selected' && selectedOrgName ? ` — ${selectedOrgName}` : ''}</h1>
            <Link href={selectedOrgSlug ? `/${selectedOrgSlug}/start` : "/start"}>
              <Button variant="ghost" size="sm" className="text-neutral-600 hover:text-neutral-900">
                {selectedOrgName ? `Submit to ${selectedOrgName}` : 'Submit New CV'}
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-neutral-600 hover:text-neutral-900">
                <Home className="w-4 h-4 mr-1" />
                Home
              </Button>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            {/* View mode segmented control */}
            <div className="hidden md:flex items-center gap-3">
              <span className="text-xs text-muted-foreground">View</span>
              <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'selected'|'all')}>
                <ToggleGroupItem value="selected" data-testid="view-selected-org">Selected</ToggleGroupItem>
                <ToggleGroupItem value="all" data-testid="view-all-orgs">All</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {/* Org filter + Search (All orgs) */}
            {viewMode === 'all' && (
              <div className="hidden md:flex items-center gap-2">
                <Select value={orgFilter} onValueChange={(v) => setOrgFilter(v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All organizations</SelectItem>
                    {orgOptions.map(([slug, name]) => (
                      <SelectItem key={slug} value={slug}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Search name, email, org"
                  className="w-56"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
            {/* Layout + Order controls (All orgs) */}
            {false && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-neutral-500">Layout:</span>
                <div className="inline-flex overflow-hidden rounded-md border border-neutral-300">
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs transition ${layoutMode === 'grouped' ? 'bg-white text-black' : 'bg-transparent text-neutral-500 hover:bg-neutral-100'}`}
                    onClick={() => setLayoutMode('grouped')}
                  >
                    Grouped
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 text-xs border-l border-neutral-300 transition ${layoutMode === 'timeline' ? 'bg-white text-black' : 'bg-transparent text-neutral-500 hover:bg-neutral-100'}`}
                    onClick={() => setLayoutMode('timeline')}
                  >
                    Timeline
                  </button>
                </div>
                <label className="flex items-center gap-1 text-xs text-neutral-500">
                  <input type="checkbox" checked={newestFirst} onChange={(e) => setNewestFirst(e.target.checked)} />
                  Newest first
                </label>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={""} />
                <AvatarFallback>
                  {email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-medium">{email?.split("@")[0]}</p>
                <p className="text-xs text-neutral-500">{email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-neutral-600 hover:text-neutral-900"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="submissions" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="submissions" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              My Submissions
            </TabsTrigger>
            <TabsTrigger value="interviews" className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              Interviews
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions">
        {/* Quick Actions */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Link href={selectedOrgSlug ? `/${selectedOrgSlug}/start` : "/start"}>
            <Button className="rounded-2xl border-[3px] border-black bg-white text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100 transition-transform">
              <FileText className="w-4 h-4 mr-2" />
              {selectedOrgName ? `New Submission to ${selectedOrgName}` : 'New Submission'}
            </Button>
          </Link>
          <Link href="/jobs">
            <Button className="rounded-2xl border-[3px] border-black bg-[#ffd6a5] text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-[#ffd6a5]/90 transition-transform">
              <Briefcase className="w-4 h-4 mr-2" />
              Browse Open Jobs
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              const params = new URLSearchParams()
              const mode = viewMode === 'all' ? 'all' : 'selected'
              params.set('mode', mode)
              if (mode === 'selected' && selectedOrgSlug) params.set('org', selectedOrgSlug)
              if (mode === 'all' && orgFilter !== 'all' && orgFilter) params.set('org', orgFilter)
              const s = statusFilter.toLowerCase(); if (s && s !== 'all') params.set('status', s)
              const ct = cvTypeFilter.toLowerCase() === 'ai' ? 'ai' : cvTypeFilter.toLowerCase(); if (ct && ct !== 'all') params.set('cvType', ct)
              const d = decisionFilter.toLowerCase(); if (d && d !== 'all') params.set('decision', d)
              if (startDate) params.set('start', startDate)
              if (endDate) params.set('end', endDate)
              const order = newestFirst ? 'desc' : 'asc'; params.set('order', order)
              window.open(`/api/student/submissions/export?${params.toString()}`, '_blank')
            }}
          >
            Download CSV
          </Button>
        </div>

        {/* Filter bar */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20 text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20 text-muted-foreground">CV Type</Label>
            <Select value={cvTypeFilter} onValueChange={(v) => setCvTypeFilter(v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="uploaded">Uploaded</SelectItem>
                <SelectItem value="ai">AI-built</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20 text-muted-foreground">Decision</Label>
            <Select value={decisionFilter} onValueChange={(v) => setDecisionFilter(v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="shortlisted">Shortlisted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="interviewed">Interviewed</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20 text-muted-foreground">Start</Label>
            <Input type="date" className="flex-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20 text-muted-foreground">End</Label>
            <Input type="date" className="flex-1" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Info note about downloads */}
        <div className="mb-6 text-xs text-neutral-500">
          Note: Download links are temporary and expire shortly for your privacy.
        </div>

        {/* Submissions */}
        {(!Array.isArray(displayedSubmissions) || displayedSubmissions.length === 0) ? (
          <Card className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-neutral-600" />
            <h2 className="text-xl font-semibold mb-2">No submissions yet</h2>
            <p className="text-neutral-600 mb-6">
              {viewMode === 'selected' 
                ? 'Start by uploading your CV or building one with AI for this organization.' 
                : 'No applications yet across organizations. Apply to multiple companies to build your timeline.'}
            </p>
            <div className="flex gap-4 justify-center">
              <Link href={selectedOrgSlug ? `/${selectedOrgSlug}/start` : "/start"}>
                <Button className="bg-white text-black hover:bg-gray-100">
                  {selectedOrgName ? `Submit CV to ${selectedOrgName}` : 'Submit CV to Organization'}
                </Button>
              </Link>
              <Link href="/start">
                <Button variant="outline">Apply to more organizations</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayedSubmissions
              .sort((a, b) => (newestFirst ? (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())))
              .map((s) => (
                <Card key={s.id} className="rounded-2xl border-2 border-black bg-white shadow-[6px_6px_0_#111] p-6">
                  <div className="flex justify-between items-start mb-5 md:mb-6">
                    <div>
                      {s.org_name && (
                        <Link
                          href={`/career/dashboard?org=${encodeURIComponent(s.org_slug)}`}
                          className="inline-flex items-center gap-2 mb-1 text-foreground rounded-md px-1 -mx-1 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                          aria-label={`View submissions for ${s.org_name}`}
                        >
                          <Avatar className="h-5 w-5 ring-1 ring-neutral-200 bg-white">
                            {s.org_logo ? (
                              <AvatarImage src={s.org_logo} alt={s.org_name} className="object-cover" />
                            ) : null}
                            <AvatarFallback className="text-[10px] font-medium text-neutral-700">
                              {getInitials(s.org_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{s.org_name}</span>
                        </Link>
                      )}
                      <h3 className="font-semibold">{s.name}</h3>
                      <p className="text-sm text-muted-foreground">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end max-w-[60%]">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded ${getStatusChipClass(s.parse_status)}`}
                        title={`Parsing status: ${getStatusLabel(s.parse_status)}`}
                        aria-label={`Parsing status: ${getStatusLabel(s.parse_status)}`}
                      >
                        {getStatusLabel(s.parse_status)}
                      </span>
                      {getCvTypeLabel(s.cv_type) && (
                        <span
                          className="text-xs px-2.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200"
                          title={`CV source: ${getCvTypeLabel(s.cv_type)}`}
                          aria-label={`CV source: ${getCvTypeLabel(s.cv_type)}`}
                        >
                          {getCvTypeLabel(s.cv_type)}
                        </span>
                      )}
                      {(() => {
                        const dec = getDecisionLabel((s as any).decision_status || (s as any)?.knet_profile?.decision_status)
                        return (
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded ${getDecisionChipClass((s as any).decision_status || (s as any)?.knet_profile?.decision_status)}`}
                            title={`Decision: ${dec}`}
                            aria-label={`Decision: ${dec}`}
                          >
                            {dec}
                          </span>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(s.created_at), 'PPp')}
                    </div>
                    {(() => {
                      const feedback = (s as any).ai_feedback || s?.knet_profile?.ai_feedback || ''
                      if (!feedback) return null
                      const text = feedback.length > 160 ? feedback.slice(0, 160) + '…' : feedback
                      return (
                        <div className="text-xs text-muted-foreground border border-border rounded p-2">
                          <span className="text-muted-foreground mr-1">AI feedback:</span>
                          {text}
                        </div>
                      )
                    })()}
                    {s.knet_profile && (() => {
                      const kp: any = s.knet_profile || {}
                      const degree = kp.degree ?? kp.degreeBucket
                      const yoe = kp.yearsOfExperience ?? kp.yearsOfExperienceBucket
                      if (!degree && !yoe) return null
                      return (
                        <div className="text-sm text-neutral-600">
                          {degree}{degree && yoe ? ' • ' : ''}{yoe}
                        </div>
                      )
                    })()}
                  </div>

                  <div className="flex gap-2">
                    {s.cv_file_key && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-2xl border-[2px] border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                        title="Download CV"
                        aria-label="Download CV"
                        onClick={() => {
                          const url = `/api/student/cv/download?key=${encodeURIComponent(s.cv_file_key)}&org=${encodeURIComponent(s.org_slug || '')}`
                          window.open(url, '_blank')
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-2xl border-[2px] border-black text-neutral-800 hover:bg-neutral-100"
                      aria-label={`Resubmit to ${s.org_slug}`}
                      onClick={() => handleResubmit(s.org_slug)}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-700 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      aria-label="Delete submission"
                      onClick={() => handleDelete(s.id)}
                      disabled={isDeleting === s.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            {loadingMore && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={`skeleton-${i}`} className="bg-white border-[3px] border-black rounded p-6 animate-pulse shadow-[6px_6px_0_#111]">
                    <div className="h-4 w-1/3 bg-neutral-200 rounded mb-2"></div>
                    <div className="h-3 w-1/2 bg-neutral-200 rounded mb-6"></div>
                    <div className="h-24 w-full bg-neutral-200 rounded"></div>
                  </div>
                ))}
              </div>
            )}
            {/* Load More */}
            <div className="flex justify-center py-4">
              <Button
                variant="outline"
                className="rounded-2xl border-[3px] border-black text-neutral-900 bg-white shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100 transition-transform"
                disabled={loadingMore || (viewMode === 'all' ? !hasMoreAll : !hasMoreSelected)}
                onClick={loadMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          </div>
        )}
          </TabsContent>

          <TabsContent value="interviews">
            <StudentInterviews />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
