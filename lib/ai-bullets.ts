export class AIBulletsError extends Error {
  code: number
  needs?: string[]
  constructor(message: string, code: number, needs?: string[]) {
    super(message)
    this.code = code
    this.needs = needs
  }
}

export function tidyBullets(list: string[]): string[] {
  return (Array.isArray(list) ? list : [])
    .map(b => (b ?? '').toString())
    .map(b => b.trim().replace(/^[−\-•\s]*/, '').replace(/^(i['’]m|i am)\b/i, '').replace(/\s+/g, ' '))
    .map(b => (b[0] ? b[0].toUpperCase() + b.slice(1) : b))
    .map(b => /[.!?]$/.test(b) ? b : b + '.')
    .filter(Boolean)
}

export type ExperienceInput = {
  position?: string
  company?: string
  location?: string
  startDate?: string
  endDate?: string
  current?: boolean
  description?: string
  bullets?: string[]
  technologies?: string[]
}

export type ProjectInput = {
  name?: string
  url?: string
  technologies?: string[]
  description?: string
  bullets?: string[]
}

export async function generateAIBullets(opts: {
  section: 'experience'|'projects'
  description?: string
  experience?: ExperienceInput
  project?: ProjectInput
  personalInfo?: { fullName?: string; email?: string }
  jobDescription?: string
  locale?: 'en'|'ar'
  signal?: AbortSignal
}): Promise<string[]> {
  const { section, description = '', experience, project, personalInfo, jobDescription, locale = 'en', signal } = opts

  // 1) Try legacy rewrite endpoint first (fast path)
  try {
    const rewriteRes = await fetch('/api/ai/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText: description, section }),
      signal,
    })
    if (rewriteRes.ok) {
      const data = await rewriteRes.json().catch(() => ({} as any))
      const bullets: string[] = tidyBullets(Array.isArray(data?.bullets) ? data.bullets : [])
      if (bullets.length > 0) return bullets.slice(0, 5)
    }
  } catch (e) {
    // ignore network error here — we will fallback below
  }

  // 2) Fallback to career-assistant
  const form: any = { personalInfo: { fullName: personalInfo?.fullName || '', email: personalInfo?.email || '' } }
  if (section === 'experience') {
    form.experience = [
      {
        title: experience?.position || '',
        company: experience?.company || '',
        location: experience?.location || '',
        startDate: experience?.startDate || '',
        endDate: experience?.endDate || '',
        bullets: Array.isArray(experience?.bullets) ? experience!.bullets : [],
        technologies: Array.isArray(experience?.technologies) ? experience!.technologies : [],
        description: experience?.description || ''
      }
    ]
  } else {
    form.projects = [
      {
        name: project?.name || '',
        description: project?.description || '',
        technologies: Array.isArray(project?.technologies) ? project!.technologies : [],
        url: project?.url || '',
        bullets: Array.isArray(project?.bullets) ? project!.bullets : [],
      }
    ]
  }

  const parsedCvParts: string[] = []
  if (section === 'experience' && experience) {
    if (experience.position) parsedCvParts.push(`Position: ${experience.position}`)
    if (experience.company) parsedCvParts.push(`Company: ${experience.company}`)
    if (experience.startDate) parsedCvParts.push(`Start: ${experience.startDate}`)
    if (experience.endDate || experience.current) parsedCvParts.push(`End: ${experience.current ? 'Present' : experience.endDate}`)
    if (experience.description) parsedCvParts.push(`Description: ${experience.description}`)
    if (Array.isArray(experience.bullets) && experience.bullets.length > 0) parsedCvParts.push(`Bullets: ${experience.bullets.join('; ')}`)
  } else if (section === 'projects' && project) {
    if (project.name) parsedCvParts.push(`Project: ${project.name}`)
    if (project.url) parsedCvParts.push(`URL: ${project.url}`)
    if (Array.isArray(project.technologies) && project.technologies.length > 0) parsedCvParts.push(`Technologies: ${project.technologies.join(', ')}`)
    if (project.description) parsedCvParts.push(`Description: ${project.description}`)
    if (Array.isArray(project.bullets) && project.bullets.length > 0) parsedCvParts.push(`Bullets: ${project.bullets.join('; ')}`)
  }

  const bulletsInput = section === 'experience'
    ? {
        company: experience?.company || '',
        title: experience?.position || '',
        isCurrent: !!experience?.current,
        rawNotes: experience?.description || '',
        techCsv: Array.isArray(experience?.technologies) ? experience!.technologies.join(', ') : ''
      }
    : {
        name: project?.name || '',
        rawNotes: project?.description || '',
        techCsv: Array.isArray(project?.technologies) ? project!.technologies.join(', ') : ''
      }

  const res = await fetch('/api/ai/career-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'bullets',
      locale,
      tone: 'professional',
      form,
      parsedCv: parsedCvParts.join('\n'),
      jobDescription: (jobDescription || '').slice(0, 3000),
      bulletsInput,
    }),
    signal,
  })

  if (res.status === 200) {
    const data = await res.json().catch(() => ({} as any))
    const raw = data?.bullets || (section === 'experience' ? data?.cv?.experience?.[0]?.bullets : data?.cv?.projects?.[0]?.bullets) || []
    const cleaned = tidyBullets(Array.isArray(raw) ? raw : []).slice(0, 5)
    return cleaned
  }

  if (res.status === 422) {
    const data = await res.json().catch(() => ({} as any))
    const needs: string[] = Array.isArray(data?.needs) ? data.needs : []
    throw new AIBulletsError('Unprocessable', 422, needs)
  }

  if (res.status === 429) {
    throw new AIBulletsError('Rate limited', 429)
  }

  throw new AIBulletsError(`Failed to generate bullets: ${res.status}`, res.status)
}
