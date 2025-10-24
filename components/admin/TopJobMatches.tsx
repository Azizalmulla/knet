'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Mail, User, Loader2, TrendingUp, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface MatchedCandidate {
  id: string
  full_name: string
  email: string
  phone: string | null
  field_of_study: string | null
  years_of_experience: string | null
  gpa: number | null
  cv_url: string | null
  match_percentage: number
  match_reason: string
  highlights: string[]
}

interface TopJobMatchesProps {
  orgSlug: string
  jobId: string
}

export default function TopJobMatches({ orgSlug, jobId }: TopJobMatchesProps) {
  const router = useRouter()
  const [matches, setMatches] = useState<MatchedCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [emailingAll, setEmailingAll] = useState(false)

  useEffect(() => {
    fetchMatches()
  }, [orgSlug, jobId])

  const fetchMatches = async () => {
    try {
      const res = await fetch(`/api/${orgSlug}/jobs/${jobId}/matches`)
      if (res.ok) {
        const data = await res.json()
        setMatches(data.matches || [])
        if (data.message) {
          setError(data.message)
        }
      } else {
        setError('Unable to load AI matches')
      }
    } catch (err) {
      console.error('Failed to load matches:', err)
      setError('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailAll = async () => {
    if (matches.length === 0) return
    
    setEmailingAll(true)
    const emails = matches.map(m => m.email).join(',')
    
    // Redirect to mailto or your email compose system
    window.location.href = `mailto:${emails}?subject=Job Opportunity`
    
    setTimeout(() => setEmailingAll(false), 1000)
    toast.success('Email client opened with all candidates')
  }

  const handleViewCV = (candidateId: string) => {
    router.push(`/${orgSlug}/admin?candidate=${candidateId}`)
  }

  if (loading) {
    return (
      <Card className="border-[3px] border-black rounded-2xl shadow-[6px_6px_0_#111] bg-gradient-to-br from-[#ffd6a5] to-[#ffedd5]">
        <CardContent className="pt-6 flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <p className="text-sm text-muted-foreground">AI analyzing candidates...</p>
        </CardContent>
      </Card>
    )
  }

  if (error && matches.length === 0) {
    return (
      <Card className="border-[3px] border-black rounded-2xl shadow-[6px_6px_0_#111] bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="pt-6 text-center py-8">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (matches.length === 0) {
    return null
  }

  return (
    <Card className="border-[3px] border-black rounded-2xl shadow-[6px_6px_0_#111] bg-gradient-to-br from-[#ffd6a5] to-[#ffedd5]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Sparkles className="w-6 h-6" />
              Top {matches.length} AI Matches
            </CardTitle>
            <CardDescription className="mt-1">
              AI-powered candidate recommendations for this role
            </CardDescription>
          </div>
          {matches.length > 1 && (
            <Button
              onClick={handleEmailAll}
              disabled={emailingAll}
              size="sm"
              className="rounded-2xl border-[2px] border-black bg-black text-white shadow-[4px_4px_0_#111] hover:-translate-y-0.5 transition-transform"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email All {matches.length}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {matches.map((candidate, index) => (
          <div
            key={candidate.id}
            className="relative bg-white border-[3px] border-black rounded-xl p-4 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#111] transition-all cursor-pointer"
            onClick={() => handleViewCV(candidate.id)}
          >
            {/* Match Badge */}
            <div className="absolute -top-2 -left-2 bg-black text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm border-[2px] border-white">
              #{index + 1}
            </div>

            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg border-[2px] border-black flex-shrink-0">
                {candidate.full_name[0]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="font-bold text-lg text-black">{candidate.full_name}</h4>
                    <p className="text-sm text-neutral-600">{candidate.email}</p>
                  </div>
                  <Badge 
                    className="bg-green-500 text-white border-[2px] border-black px-3 py-1 text-sm font-bold"
                  >
                    {candidate.match_percentage}% Match
                  </Badge>
                </div>

                {/* Match Reason */}
                <div className="bg-neutral-50 border-[2px] border-neutral-200 rounded-lg p-2 mb-2">
                  <p className="text-sm font-medium text-neutral-700">
                    <TrendingUp className="w-4 h-4 inline mr-1" />
                    {candidate.match_reason}
                  </p>
                </div>

                {/* Highlights */}
                {candidate.highlights && candidate.highlights.length > 0 && (
                  <div className="space-y-1">
                    {candidate.highlights.map((highlight, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-neutral-600">
                        <CheckCircle className="w-3 h-3 mt-0.5 text-green-600 flex-shrink-0" />
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Info */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {candidate.field_of_study && (
                    <Badge variant="outline" className="text-xs">
                      {candidate.field_of_study}
                    </Badge>
                  )}
                  {candidate.years_of_experience && (
                    <Badge variant="outline" className="text-xs">
                      {candidate.years_of_experience} experience
                    </Badge>
                  )}
                  {candidate.gpa && (
                    <Badge variant="outline" className="text-xs">
                      GPA: {candidate.gpa}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleViewCV(candidate.id)
                  }}
                  className="border-[2px] border-black rounded-lg hover:bg-neutral-100"
                >
                  <User className="w-4 h-4 mr-1" />
                  View CV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.location.href = `mailto:${candidate.email}`
                  }}
                  className="border-[2px] border-black rounded-lg hover:bg-neutral-100"
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              </div>
            </div>
          </div>
        ))}

        {/* View All Button */}
        <Button
          onClick={() => router.push(`/${orgSlug}/admin?job=${jobId}`)}
          variant="outline"
          className="w-full border-[2px] border-black rounded-xl hover:bg-white/50 mt-2"
        >
          View All Candidates →
        </Button>
      </CardContent>
    </Card>
  )
}
