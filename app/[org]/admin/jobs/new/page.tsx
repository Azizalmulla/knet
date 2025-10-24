"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import JobTitleSuggestions from '@/components/admin/JobTitleSuggestions'

export default function NewJobPage({ params }: { params: { org: string } }) {
  const router = useRouter()
  const orgSlug = params.org
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    job_type: 'full-time',
    work_mode: 'remote',
    salary_min: '',
    salary_max: '',
    salary_currency: 'KWD',
    description: '',
    requirements: '',
    responsibilities: '',
    benefits: '',
    status: 'open'
  })
  
  const [skills, setSkills] = useState<string[]>([])
  const [skillInput, setSkillInput] = useState('')

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const addSkill = () => {
    const skill = skillInput.trim()
    if (skill && !skills.includes(skill)) {
      setSkills([...skills, skill])
      setSkillInput('')
    }
  }

  const removeSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        ...formData,
        salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
        salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
        skills
      }

      const res = await fetch(`/api/${orgSlug}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create job')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/${orgSlug}/admin/jobs/${data.job.id}`)
      }, 1000)

    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Post New Job</h1>
            <p className="text-sm text-muted-foreground">Create a new job opening</p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/${orgSlug}/admin/jobs`)}
          >
            Cancel
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Job Details</CardTitle>
              <CardDescription>Fill in the information about this position</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    Job posted successfully! Redirecting...
                  </AlertDescription>
                </Alert>
              )}

              {/* Title */}
              <div>
                <Label htmlFor="title">Job Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Senior React Developer"
                  required
                />
              </div>

              {/* AI Title Suggestions */}
              {formData.description && (
                <JobTitleSuggestions
                  description={formData.description}
                  requirements={formData.requirements}
                  responsibilities={formData.responsibilities}
                  onSelectTitle={(title) => handleChange('title', title)}
                  currentTitle={formData.title}
                />
              )}

              {/* Department & Location */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => handleChange('department', e.target.value)}
                    placeholder="e.g., Engineering"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder="e.g., Kuwait City, Remote"
                  />
                </div>
              </div>

              {/* Job Type & Work Mode */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="job_type">Job Type</Label>
                  <Select value={formData.job_type} onValueChange={(v) => handleChange('job_type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full-time">Full-time</SelectItem>
                      <SelectItem value="part-time">Part-time</SelectItem>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="internship">Internship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="work_mode">Work Mode</Label>
                  <Select value={formData.work_mode} onValueChange={(v) => handleChange('work_mode', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Salary */}
              <div>
                <Label>Salary Range (Optional)</Label>
                <div className="grid grid-cols-[100px_1fr_1fr] gap-2 mt-1">
                  <Select value={formData.salary_currency} onValueChange={(v) => handleChange('salary_currency', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KWD">KWD</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    value={formData.salary_min}
                    onChange={(e) => handleChange('salary_min', e.target.value)}
                    placeholder="Min"
                  />
                  <Input
                    type="number"
                    value={formData.salary_max}
                    onChange={(e) => handleChange('salary_max', e.target.value)}
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label htmlFor="description">Job Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Describe the role, team, and what makes this opportunity great..."
                  rows={6}
                  required
                />
              </div>

              {/* Requirements */}
              <div>
                <Label htmlFor="requirements">Requirements</Label>
                <Textarea
                  id="requirements"
                  value={formData.requirements}
                  onChange={(e) => handleChange('requirements', e.target.value)}
                  placeholder="List the qualifications, experience, and skills needed..."
                  rows={4}
                />
              </div>

              {/* Responsibilities */}
              <div>
                <Label htmlFor="responsibilities">Responsibilities</Label>
                <Textarea
                  id="responsibilities"
                  value={formData.responsibilities}
                  onChange={(e) => handleChange('responsibilities', e.target.value)}
                  placeholder="What will this person be doing day-to-day?"
                  rows={4}
                />
              </div>

              {/* Benefits */}
              <div>
                <Label htmlFor="benefits">Benefits</Label>
                <Textarea
                  id="benefits"
                  value={formData.benefits}
                  onChange={(e) => handleChange('benefits', e.target.value)}
                  placeholder="Health insurance, vacation days, remote work, etc..."
                  rows={3}
                />
              </div>

              {/* Skills */}
              <div>
                <Label htmlFor="skills">Required Skills</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="skills"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addSkill()
                      }
                    }}
                    placeholder="Add a skill and press Enter"
                  />
                  <Button type="button" onClick={addSkill} variant="secondary">
                    Add
                  </Button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="pl-3 pr-2 py-1">
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open - Start accepting applications</SelectItem>
                    <SelectItem value="draft">Draft - Save but don't publish yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading ? 'Posting...' : 'Post Job'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${orgSlug}/admin/jobs`)}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
