'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Download, Sparkles, FileText, Users, MessageSquare, HelpCircle } from 'lucide-react'
import { getFields, getAreasForField } from '@/lib/career-map'

interface CVData {
  personalInfo?: {
    fullName?: string
    email?: string
    phone?: string
    location?: string
    links?: {
      linkedin?: string
      github?: string
      portfolio?: string
    }
    summary?: string
  }
  education?: Array<{
    degree: string
    institution?: string
    location?: string
    startDate?: string
    endDate?: string
    details?: string[]
  }>
  experience?: Array<{
    title: string
    company?: string
    location?: string
    startDate?: string
    endDate?: string
    bullets: string[]
    technologies?: string[]
  }>
  projects?: Array<{
    name: string
    description?: string
    technologies?: string[]
    bullets: string[]
    link?: string
  }>
  skills?: {
    programmingLanguages?: string[]
    frameworksLibraries?: string[]
    databases?: string[]
    toolsPlatforms?: string[]
    softSkills?: string[]
    languages?: string[]
  }
}

interface CareerAssistantResponse {
  cv?: CVData
  careerSuggestions?: string[]
  coverLetter?: string
  interviewQuestions?: string[]
  needs?: string[]
}

export default function CareerAssistant() {
  const [loading, setLoading] = useState(false)
  const [activeTask, setActiveTask] = useState<string>('')
  const [mode, setMode] = useState<'complete'|'optimize'|'suggestRoles'|'coverLetter'|'interviewPrep'>('complete')
  const [fieldOfStudy, setFieldOfStudy] = useState('')
  const [areaOfInterest, setAreaOfInterest] = useState('')
  const [tone, setTone] = useState<'professional'|'creative'|'academic'>('professional')
  const [language, setLanguage] = useState<'english'|'arabic'|'kuwaiti_arabic'>('english')
  const [targetRole, setTargetRole] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [parsedCv, setParsedCv] = useState('')
  const [cvData, setCvData] = useState<CVData | null>(null)
  const [result, setResult] = useState<CareerAssistantResponse | null>(null)
  const [existingCV, setExistingCV] = useState('')
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const fields = getFields()
  const areas = fieldOfStudy ? getAreasForField(fieldOfStudy) : []

  const callCareerAssistant = async (selectedMode?: typeof mode) => {
    setLoading(true)
    setActiveTask(selectedMode || mode)
    setErrorBanner(null)
    setResult(null)
    
    try {
      let parsedCvData: CVData | null = null
      if (existingCV.trim()) {
        try {
          parsedCvData = JSON.parse(existingCV)
        } catch (e) {
          setErrorBanner('Invalid JSON in Existing CV. Please fix and try again.')
          setLoading(false)
          setActiveTask('')
          return
        }
      }

      const locale = language === 'arabic' ? 'ar' : language === 'kuwaiti_arabic' ? 'kw' : 'en'
      // One-line frontend rule: if the user types in Arabic anywhere, force lang = 'ar'
      const AR_RE = /[\u0600-\u06FF]/
      const hasArabic = AR_RE.test(existingCV) || AR_RE.test(parsedCv) || AR_RE.test(jobDescription) || (() => {
        try { return AR_RE.test(JSON.stringify(parsedCvData || cvData || {})) } catch { return false }
      })()
      const effectiveLocale = hasArabic ? 'ar' : locale

      const response = await fetch('/api/ai/career-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: selectedMode || mode,
          locale: effectiveLocale,
          tone,
          form: parsedCvData || cvData || {},
          parsedCv: parsedCv || undefined,
          jobDescription: jobDescription || undefined,
          fieldOfStudy,
          areaOfInterest,
          targetRole
        })
      })

      if (!response.ok) {
        if (response.status === 422) {
          const data = await response.json()
          const needs: string[] = data?.needs || []
          setResult({ needs })
          setErrorBanner('Add the missing info (see chips below), then retry.')
          return
        }
        if (response.status === 429) {
          setErrorBanner('Model is busy. Try again in a moment.')
          return
        }
        throw new Error('Failed to get career assistance')
      }

      const data: CareerAssistantResponse = await response.json()
      setResult(data)
      
      if (data.cv) {
        setCvData(data.cv)
      }
    } catch (error) {
      console.error('Career Assistant error:', error)
      setErrorBanner('Something went wrong. Please try again later.')
    } finally {
      setLoading(false)
      setActiveTask('')
    }
  }

  const downloadCV = () => {
    if (!result?.cv) return
    
    const dataStr = JSON.stringify(result.cv, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = 'cv-data.json'
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          AI Career Assistant
        </h1>
        <p className="text-muted-foreground">
          Generate, optimize, and enhance your CV with AI-powered career guidance
        </p>
      </div>

      {errorBanner && (
        <div className="rounded-md bg-secondary/10 border border-border p-3 text-foreground">
          {errorBanner}
        </div>
      )}

      {/* Configuration Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mode-select">Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="optimize">Optimize</SelectItem>
                  <SelectItem value="suggestRoles">Suggest Roles</SelectItem>
                  <SelectItem value="coverLetter">Cover Letter</SelectItem>
                  <SelectItem value="interviewPrep">Interview Prep</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tone-select">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="academic">Academic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="language-select">Language</Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="arabic">Arabic</SelectItem>
                  <SelectItem value="kuwaiti_arabic">Kuwaiti Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="target-role">Target Role (for cover letter)</Label>
              <Input
                id="target-role"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="e.g., Software Developer, Data Analyst"
              />
            </div>

            <div>
              <Label htmlFor="field-select">Field of Study</Label>
              <Select value={fieldOfStudy} onValueChange={setFieldOfStudy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your field" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map(field => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="area-select">Area of Interest</Label>
              <Select value={areaOfInterest} onValueChange={setAreaOfInterest} disabled={!fieldOfStudy}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your area" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="existing-cv">Existing CV Data (JSON, optional)</Label>
              <Textarea
                id="existing-cv"
                value={existingCV}
                onChange={(e) => setExistingCV(e.target.value)}
                placeholder="Paste your existing CV data in JSON format here..."
                rows={6}
              />
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="parsed-cv">Parsed CV Text (optional)</Label>
                <Textarea
                  id="parsed-cv"
                  value={parsedCv}
                  onChange={(e) => setParsedCv(e.target.value)}
                  placeholder="Paste raw resume text (will be trimmed)"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="job-desc">Job Description (for Optimize)</Label>
                <Textarea
                  id="job-desc"
                  value={jobDescription}
                  maxLength={3000}
                  onChange={(e) => setJobDescription(e.target.value.slice(0, 3000))}
                  placeholder="Paste job description to tailor bullets (React, TypeScript, Next.js, Tailwind...)"
                  rows={3}
                />
                <div className="mt-1 text-xs text-muted-foreground">{jobDescription.length}/3000</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={() => callCareerAssistant()} disabled={loading} className="h-10">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span className="ltr:ml-2 rtl:mr-2">Run</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions (optional) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button
          onClick={() => callCareerAssistant('complete')}
          disabled={loading}
          className="h-20 flex flex-col gap-2"
        >
          {loading && activeTask === 'complete' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
          <span className="text-sm">Create CV</span>
        </Button>

        <Button
          onClick={() => callCareerAssistant('complete')}
          disabled={loading}
          variant="outline"
          className="h-20 flex flex-col gap-2"
        >
          {loading && activeTask === 'complete' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          <span className="text-sm">Complete Sections</span>
        </Button>

        <Button
          onClick={() => callCareerAssistant('optimize')}
          disabled={loading}
          variant="outline"
          className="h-20 flex flex-col gap-2"
        >
          {loading && activeTask === 'optimize' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          <span className="text-sm">ATS Optimize</span>
        </Button>

        <Button
          onClick={() => callCareerAssistant('suggestRoles')}
          disabled={loading}
          variant="outline"
          className="h-20 flex flex-col gap-2"
        >
          {loading && activeTask === 'suggestRoles' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Users className="h-5 w-5" />
          )}
          <span className="text-sm">Career Ideas</span>
        </Button>

        <Button
          onClick={() => callCareerAssistant('coverLetter')}
          disabled={loading}
          variant="outline"
          className="h-20 flex flex-col gap-2"
        >
          {loading && activeTask === 'coverLetter' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <MessageSquare className="h-5 w-5" />
          )}
          <span className="text-sm">Cover Letter</span>
        </Button>

        <Button
          onClick={() => callCareerAssistant('interviewPrep')}
          disabled={loading}
          variant="outline"
          className="h-20 flex flex-col gap-2"
        >
          {loading && activeTask === 'interviewPrep' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <HelpCircle className="h-5 w-5" />
          )}
          <span className="text-sm">Interview Prep</span>
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {result.needs && result.needs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Missing Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.needs.map((n, i) => (
                    <span key={i} className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">{n}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.cv && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Generated CV</CardTitle>
                <Button onClick={downloadCV} size="sm" variant="outline">
                  <Download className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  Download JSON
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                  {JSON.stringify(result.cv, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {result.careerSuggestions && (
            <Card>
              <CardHeader>
                <CardTitle>Career Suggestions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.careerSuggestions.map((suggestion, index) => (
                    <span
                      key={index}
                      className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm"
                    >
                      {suggestion}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.coverLetter && (
            <Card>
              <CardHeader>
                <CardTitle>Cover Letter</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{result.coverLetter}</p>
              </CardContent>
            </Card>
          )}

          {result.interviewQuestions && (
            <Card>
              <CardHeader>
                <CardTitle>Interview Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {result.interviewQuestions.map((question, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm font-medium min-w-[24px] text-center">
                        {index + 1}
                      </span>
                      <span className="text-foreground">{question}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
