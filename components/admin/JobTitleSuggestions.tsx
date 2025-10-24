'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Loader2, TrendingUp, Award, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface TitleSuggestion {
  title: string
  reason: string
  level: 'entry' | 'mid' | 'senior' | 'any'
  popularity: string
}

interface JobTitleSuggestionsProps {
  description: string
  requirements?: string
  responsibilities?: string
  onSelectTitle: (title: string) => void
  currentTitle?: string
}

export default function JobTitleSuggestions({ 
  description, 
  requirements, 
  responsibilities,
  onSelectTitle,
  currentTitle 
}: JobTitleSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)

  const fetchSuggestions = async () => {
    if (description.length < 20) {
      toast.error('Please write more job description first (at least 20 characters)')
      return
    }

    setLoading(true)
    setError('')
    toast.loading('AI analyzing job description...', { id: 'title-suggestions' })

    try {
      const res = await fetch('/api/suggest-job-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          requirements: requirements || '',
          responsibilities: responsibilities || ''
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to get suggestions')
      }

      const data = await res.json()
      setSuggestions(data.suggestions || [])
      setShowSuggestions(true)
      toast.success(`Found ${data.count} title suggestions!`, { id: 'title-suggestions' })
    } catch (err: any) {
      console.error('Error fetching suggestions:', err)
      setError(err.message || 'Failed to get suggestions')
      toast.error('Failed to generate suggestions', { id: 'title-suggestions' })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTitle = (title: string) => {
    onSelectTitle(title)
    toast.success(`Title updated to "${title}"`)
  }

  const getLevelBadge = (level: string) => {
    const colors: Record<string, string> = {
      entry: 'bg-green-100 text-green-800 border-green-300',
      mid: 'bg-blue-100 text-blue-800 border-blue-300',
      senior: 'bg-purple-100 text-purple-800 border-purple-300',
      any: 'bg-gray-100 text-gray-800 border-gray-300'
    }
    return colors[level] || colors.any
  }

  const getLevelLabel = (level: string) => {
    const labels: Record<string, string> = {
      entry: 'Entry Level',
      mid: 'Mid Level',
      senior: 'Senior Level',
      any: 'All Levels'
    }
    return labels[level] || 'All Levels'
  }

  const getRankIcon = (index: number) => {
    if (index === 0) return <Award className="w-5 h-5 text-yellow-500" />
    if (index === 1) return <Award className="w-5 h-5 text-gray-400" />
    if (index === 2) return <Award className="w-5 h-5 text-orange-600" />
    return <TrendingUp className="w-5 h-5 text-blue-500" />
  }

  return (
    <div className="space-y-4">
      {/* Trigger Button */}
      {!showSuggestions && (
        <Button
          type="button"
          onClick={fetchSuggestions}
          disabled={loading || description.length < 20}
          variant="outline"
          className="w-full border-[2px] border-black rounded-xl hover:bg-gradient-to-r hover:from-[#ffd6a5] hover:to-[#ffedd5] transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              AI Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Get AI Title Suggestions
            </>
          )}
        </Button>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-[2px] border-red-300 bg-red-50">
          <CardContent className="pt-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={fetchSuggestions}
              className="mt-2"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <Card className="border-[3px] border-black rounded-2xl shadow-[6px_6px_0_#111] bg-gradient-to-br from-[#ffd6a5] to-[#ffedd5]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Title Suggestions
                </CardTitle>
                <CardDescription className="mt-1">
                  Click any suggestion to use it as your job title
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowSuggestions(false)}
              >
                Hide
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                onClick={() => handleSelectTitle(suggestion.title)}
                className={`relative bg-white border-[2px] border-black rounded-xl p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#111] ${
                  currentTitle === suggestion.title ? 'ring-2 ring-green-500 bg-green-50' : ''
                }`}
              >
                {/* Selected Badge */}
                {currentTitle === suggestion.title && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-green-500 text-white border-[2px] border-black">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Selected
                    </Badge>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  {/* Rank Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getRankIcon(index)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg text-black">
                          {suggestion.title}
                        </h4>
                        {index === 0 && (
                          <Badge variant="outline" className="mt-1 text-xs border-yellow-500 text-yellow-700">
                            🏆 Best Match
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Reason */}
                    <p className="text-sm text-neutral-700 mb-3">
                      {suggestion.reason}
                    </p>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-2">
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getLevelBadge(suggestion.level)}`}
                      >
                        {getLevelLabel(suggestion.level)}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {suggestion.popularity}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Regenerate Button */}
            <Button
              type="button"
              onClick={fetchSuggestions}
              variant="outline"
              size="sm"
              className="w-full border-[2px] border-black rounded-lg hover:bg-white/50 mt-2"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Get New Suggestions
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Helper Text */}
      {!showSuggestions && description.length > 0 && description.length < 20 && (
        <p className="text-xs text-muted-foreground text-center">
          Write at least 20 characters in job description to get AI suggestions
        </p>
      )}
    </div>
  )
}
