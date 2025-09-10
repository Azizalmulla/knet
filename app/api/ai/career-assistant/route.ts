import { NextRequest, NextResponse } from 'next/server'
import { getFields, getAreasForField, matchSuggestedVacancies } from '@/lib/career-map'
import { z } from 'zod'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

// Dev rule: Enforce 10 req/5min/IP (namespaced), validate with Zod, block placeholders (422 with needs),
// trim parsedCv (~12k), return strict JSON only; UI (/career-assistant + Review step) uses new contract with clear 422/429/500 UX.

function safeLog(...args: any[]) {
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV
  if (env !== 'production') {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

async function callOpenAIWithRetry(openai: any, messages: { role: 'user' | 'system' | 'assistant'; content: string }[], retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 900,
        response_format: { type: 'json_object' },
      })
      return completion
    } catch (error: any) {
      if (error?.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
        continue
      }
      throw error
    }
  }
}

function tryParseJson<T = any>(text?: string): T | null {
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    try {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        return JSON.parse(text.slice(start, end + 1)) as T
      }
    } catch {}
    return null
  }
}

function extractSentences(text?: string): string[] {
  if (!text) return []
  return text
    .split(/\n|[.;•\-]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3)
}

function guessDescriptionFromParsedCv(parsed?: string): string | undefined {
  if (!parsed) return undefined
  const m = parsed.match(/Description:\s*([^\n]+)/i)
  return (m && m[1]?.trim()) || parsed
}

interface CVPersonalInfo {
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

interface CVEducation {
  degree: string
  institution?: string
  location?: string
  startDate?: string
  endDate?: string
  details?: string[]
}

interface CVExperience {
  title: string
  company?: string
  location?: string
  startDate?: string
  endDate?: string
  bullets: string[]
  technologies?: string[]
}

interface CVProject {
  name: string
  description?: string
  technologies?: string[]
  bullets: string[]
  link?: string
}

interface CVSkills {
  programmingLanguages?: string[]
  frameworksLibraries?: string[]
  databases?: string[]
  toolsPlatforms?: string[]
  softSkills?: string[]
  languages?: string[]
}

interface CVData {
  personalInfo?: CVPersonalInfo
  education?: CVEducation[]
  experience?: CVExperience[]
  projects?: CVProject[]
  skills?: CVSkills
}

interface CareerAssistantRequest {
  task?: 'cv_drafting' | 'section_completion' | 'ats_optimization' | 'career_suggestions' | 'cover_letter' | 'interview_prep'
  cvData?: CVData
  fieldOfStudy?: string
  areaOfInterest?: string
  tone?: 'professional' | 'creative' | 'academic'
  language?: 'english' | 'arabic' | 'kuwaiti_arabic'
  targetRole?: string
  mode?: 'complete' | 'optimize' | 'suggestRoles' | 'coverLetter' | 'interviewPrep' | 'bullets'
  locale?: 'en' | 'ar' | 'kw'
  form?: any
  parsedCv?: string
  jobDescription?: string
  bulletsInput?: {
    company?: string
    title?: string
    isCurrent?: boolean
    rawNotes?: string
    techCsv?: string
  }
}

interface CareerAssistantResponse {
  cv?: CVData
  careerSuggestions?: string[]
  coverLetter?: string
  interviewQuestions?: string[]
  needs?: string[]
}

const CvSchema = z.object({
  personalInfo: z.object({
    fullName: z.string().min(1).optional(),
    email: z.string().min(3).optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.object({ linkedin: z.string().optional(), github: z.string().optional(), portfolio: z.string().optional() }).strip().optional(),
    summary: z.string().optional(),
  }).strip().optional(),
  education: z.array(z.object({
    degree: z.string(),
    institution: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    details: z.array(z.string()).optional(),
  }).strip()).optional(),
  experience: z.array(z.object({
    title: z.string(),
    company: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    bullets: z.array(z.string()).default([]),
    technologies: z.array(z.string()).optional(),
  }).strip()).optional(),
  projects: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    technologies: z.array(z.string()).optional(),
    bullets: z.array(z.string()).default([]),
    link: z.string().optional(),
  }).strip()).optional(),
  skills: z.object({
    programmingLanguages: z.array(z.string()).optional(),
    frameworksLibraries: z.array(z.string()).optional(),
    databases: z.array(z.string()).optional(),
    toolsPlatforms: z.array(z.string()).optional(),
    softSkills: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
  }).strip().optional(),
}).strip()

const InputSchema = z.object({
  mode: z.enum(['complete','optimize','suggestRoles','coverLetter','interviewPrep','bullets']).optional(),
  locale: z.enum(['en','ar','kw']).default('en'),
  tone: z.enum(['professional','creative','academic']).default('professional'),
  form: z.any().optional(),
  parsedCv: z.string().optional(),
  jobDescription: z.string().optional(),
  task: z.enum(['cv_drafting','section_completion','ats_optimization','career_suggestions','cover_letter','interview_prep']).optional(),
  cvData: z.any().optional(),
  fieldOfStudy: z.string().optional(),
  areaOfInterest: z.string().optional(),
  bulletsInput: z.object({
    company: z.string().optional(),
    title: z.string().optional(),
    isCurrent: z.boolean().optional(),
    rawNotes: z.string().optional(),
    techCsv: z.string().optional(),
  }).optional(),
}).strip()

const OutputSchema = z.object({
  cv: CvSchema.optional(),
  careerSuggestions: z.array(z.string()).optional(),
  coverLetter: z.string().optional(),
  interviewQuestions: z.array(z.string()).optional(),
  needs: z.array(z.string()).default([]),
}).strip()

const PLACEHOLDER_RE = /\b(your name|your\.email@example\.com|portfolio\.com|kuwait university)\b/i
const hasPlaceholdersLoose = (obj: unknown) => { try { return PLACEHOLDER_RE.test(JSON.stringify(obj)); } catch { return true; } }

function pickMostRelevant(parsedCv?: string, max = 12000) {
  const s = parsedCv?.slice(0, max) ?? ''
  return s
}

function pickJobDescription(jobDescription?: string, max = 3000) {
  return jobDescription?.slice(0, max)
}

function mapLegacyTaskToMode(task?: string): 'complete'|'optimize'|'suggestRoles'|'coverLetter'|'interviewPrep'|undefined {
  const m: any = {
    cv_drafting: 'complete',
    section_completion: 'complete',
    ats_optimization: 'optimize',
    career_suggestions: 'suggestRoles',
    cover_letter: 'coverLetter',
    interview_prep: 'interviewPrep',
  }
  return task ? m[task] : undefined
}

function computeNeeds(form: any, mode: string): string[] {
  const needs: string[] = []
  const pi = form?.personalInfo || {}
  if (mode === 'complete' || mode === 'coverLetter' || mode === 'optimize' || mode === 'bullets') {
    if (!pi.fullName) needs.push('personalInfo.fullName')
    if (!pi.email) needs.push('personalInfo.email')
  }
  return needs
}

function localizeCv(cv: CVData, locale: 'en'|'ar'|'kw'): CVData {
  if (locale === 'en') return cv
  const map: Record<string,string> = locale === 'ar' ? {
    'Developed': 'طوّرت', 'Built': 'أنشأت', 'Implemented': 'نفّذت', 'Collaborated': 'تعاونت', 'Optimized': 'حسّنت', 'Designed': 'صمّمت',
  } : {
    'Developed': 'طوّرت', 'Built': 'بنيت', 'Implemented': 'طبّقت', 'Collaborated': 'تعاونا', 'Optimized': 'حسّنت', 'Designed': 'صمّمت',
  }
  const tr = (s: string) => Object.entries(map).reduce((acc,[en,ar]) => acc.replace(new RegExp(`^${en}`), ar), s)
  const out: CVData = JSON.parse(JSON.stringify(cv))
  if (out.experience) out.experience = out.experience.map(e => ({ ...e, bullets: (e.bullets||[]).map(tr) }))
  if (out.projects) out.projects = out.projects.map(p => ({ ...p, bullets: (p.bullets||[]).map(tr) }))
  return out
}

function optimizeForATS(bullets: string[], jobDescription?: string): string[] {
  const kws = (jobDescription || '').toLowerCase()
  return bullets.map(bullet => {
    let optimized = bullet
    if (!bullet.match(/^(Developed|Built|Implemented|Created|Designed|Led|Managed|Optimized|Delivered|Collaborated)/)) {
      optimized = `Developed ${bullet.replace(/^[-•\s]+/, '').replace(/^[a-z]/, (m) => m.toUpperCase())}`
    }
    if (!optimized.endsWith('.')) {
      optimized += '.'
    }
    if (kws.includes('react') && !optimized.toLowerCase().includes('react')) optimized += ' (React)'
    if (kws.includes('typescript') && !optimized.toLowerCase().includes('typescript')) optimized += ' (TypeScript)'
    if (kws.includes('next') && !optimized.toLowerCase().includes('next')) optimized += ' (Next.js)'
    return optimized
  })
}

function generateCareerSuggestions(fieldOfStudy?: string, areaOfInterest?: string): string[] {
  if (!fieldOfStudy || !areaOfInterest) {
    return ["Software Developer", "Data Analyst", "Project Manager", "Business Analyst", "Technical Consultant"]
  }
  
  const suggested = matchSuggestedVacancies(fieldOfStudy, areaOfInterest)
  if (suggested) {
    return suggested.split('/').map(s => s.trim())
  }
  
  const fields = getFields()
  if (fields.includes(fieldOfStudy)) {
    const areas = getAreasForField(fieldOfStudy)
    if (areas.length > 0) {
      return areas.slice(0, 5)
    }
  }
  
  return ["Software Developer", "Data Analyst", "Project Manager", "Business Analyst", "Technical Consultant"]
}

function generateCoverLetter(cvData: CVData, targetRole?: string, tone: string = 'professional'): string {
  const name = cvData.personalInfo?.fullName || "[Full Name]"
  const role = targetRole || "Software Developer"
  
  if (tone === 'creative') {
    return `Hi there! I'm ${name}, a passionate technologist excited about the ${role} opportunity. My journey in software development has been driven by curiosity and a love for solving complex problems. With experience in modern web technologies and a collaborative mindset, I'm ready to bring fresh ideas and technical expertise to your team. Let's build something amazing together!`
  }
  
  if (tone === 'academic') {
    return `Dear Hiring Committee, I am writing to express my interest in the ${role} position. My academic background and research experience have equipped me with strong analytical skills and deep technical knowledge. I have demonstrated proficiency in software development methodologies and maintain a commitment to continuous learning and professional development. I would welcome the opportunity to contribute to your organization's objectives.`
  }
  
  return `Dear Hiring Manager, I am writing to express my strong interest in the ${role} position. With a solid foundation in software development and hands-on experience building scalable applications, I am confident in my ability to contribute effectively to your team. My technical skills, combined with strong communication and problem-solving abilities, make me well-suited for this role. I look forward to discussing how my background aligns with your needs.`
}

function generateInterviewQuestions(cvData: CVData): string[] {
  const questions = [
    "Tell me about yourself and your background in software development.",
    "Describe a challenging technical problem you've solved and your approach.",
    "How do you stay current with new technologies and industry trends?",
    "Walk me through your experience with version control and collaborative development.",
    "What interests you most about this role and our company?"
  ]
  
  if (cvData.experience && cvData.experience.length > 0) {
    questions.push("Tell me about your experience at [previous company] and key accomplishments.")
  }
  
  if (cvData.projects && cvData.projects.length > 0) {
    questions.push("Describe the technical architecture of one of your projects.")
  }
  
  return questions.slice(0, 5)
}

function generateDefaultCV(fieldOfStudy?: string, areaOfInterest?: string, formOverrides?: Partial<CVData>): CVData {
  const base: CVData = {
    personalInfo: formOverrides?.personalInfo ?? {},
    education: formOverrides?.education && formOverrides.education.length > 0 ? formOverrides.education : [
      {
        degree: fieldOfStudy ? `B.Sc. in ${fieldOfStudy}` : 'B.Sc. in Computer Science',
        institution: 'Local University',
        location: 'Kuwait',
        startDate: '2019-09',
        endDate: '2023-06',
        details: [
          'GPA: 3.6/4.0',
          'Relevant Coursework: Data Structures, Algorithms, Databases, Software Engineering',
          'Capstone: Built a full-stack application with modern web technologies',
        ],
      },
    ],
    experience: formOverrides?.experience ?? [
      {
        title: 'Intern',
        company: 'Technology Company',
        location: 'Kuwait City, Kuwait',
        startDate: '2023-06',
        endDate: '2023-09',
        bullets: [
          'Developed software solutions using modern frameworks and best practices.',
          'Collaborated with cross-functional teams to deliver high-quality products.',
          'Implemented testing strategies and CI/CD pipelines for reliable deployments.',
        ],
        technologies: ['JavaScript','React','Node.js','SQL'],
      },
    ],
    projects: formOverrides?.projects ?? [
      {
        name: 'Academic Project',
        description: 'Full-stack web application demonstrating technical proficiency.',
        technologies: ['React','Node.js','PostgreSQL','TypeScript'],
        bullets: [
          'Built responsive user interface with modern design principles.',
          'Implemented secure backend APIs with proper authentication.',
          'Deployed application with monitoring and performance optimization.',
        ],
      },
    ],
    skills: formOverrides?.skills ?? {
      programmingLanguages: ['JavaScript','TypeScript','Python','SQL'],
      frameworksLibraries: ['React','Node.js','Express'],
      databases: ['PostgreSQL','MongoDB'],
      toolsPlatforms: ['Git','Docker','AWS'],
      softSkills: ['Communication','Problem Solving','Teamwork','Time Management'],
      languages: ['English','Arabic'],
    },
  }
  return base
}

export async function POST(request: NextRequest) {
  // Namespaced rate limit: 10 req / 5 min / IP
  const rl = checkRateLimitWithConfig(request, { maxRequests: 10, namespace: 'career-assistant' })
  if (!rl.success) return createRateLimitResponse(rl)

  const started = Date.now()
  try {
    const raw = await request.json()
    const input = InputSchema.safeParse(raw)
    if (!input.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: input.error.flatten() }, { status: 400 })
    }

    const body = input.data as any
    const mode: 'complete'|'optimize'|'suggestRoles'|'coverLetter'|'interviewPrep'|'bullets' = body.mode || mapLegacyTaskToMode(body.task) || 'complete'
    const locale: 'en'|'ar'|'kw' = body.locale || (body.language === 'arabic' ? 'ar' : body.language === 'kuwaiti_arabic' ? 'kw' : 'en')
    const tone = body.tone || 'professional'
    const form = body.form || body.cvData || {}
    const fieldOfStudy = body.fieldOfStudy || form?.education?.[0]?.fieldOfStudy
    const areaOfInterest = body.areaOfInterest || form?.education?.[0]?.areaOfInterest
    const parsedCv = pickMostRelevant(body.parsedCv)
    const jobDescription = pickJobDescription(body.jobDescription)

    const resp: CareerAssistantResponse = { needs: computeNeeds(form, mode) }

    // Suggest roles: quick path
    if (mode === 'suggestRoles') {
      resp.careerSuggestions = generateCareerSuggestions(fieldOfStudy, areaOfInterest)
      const out = OutputSchema.parse(resp)
      safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
      return NextResponse.json(out)
    }

    // Guard missing inputs early
    if (resp.needs && resp.needs.length > 0) {
      safeLog('ALERT:CAREER_ASSIST_422', { mode, locale, duration: Date.now()-started, needs: resp.needs.length })
      return NextResponse.json({ needs: resp.needs }, { status: 422 })
    }

    if (mode === 'bullets') {
      const e = form?.experience?.[0] || {}
      const company = body?.bulletsInput?.company || e?.company || ''
      const title = body?.bulletsInput?.title || e?.title || ''
      const isCurrent = !!(body?.bulletsInput?.isCurrent || e?.endDate === undefined)
      const rawNotes = body?.bulletsInput?.rawNotes || e?.description || guessDescriptionFromParsedCv(parsedCv) || ''
      const techCsv = body?.bulletsInput?.techCsv || (Array.isArray(e?.technologies) ? e.technologies.join(', ') : '')

      // If OpenAI key exists, use model per provided prompt; otherwise fallback to heuristic ATS optimization
      if (process.env.OPENAI_API_KEY) {
        try {
          const { default: OpenAI } = await import('openai')
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const userPrompt = `Use this when the user clicks the “Generate ATS Bullets” button. Send company, title, rawNotes, tech, optional jobDescription, and the ONLY output should be a JSON array bullets.\nYou are an ATS rewrite assistant. Rewrite raw notes into 3–5 crisp, impact-focused bullets.\n\nRules:\n- Start each bullet with a strong verb (Designed, Built, Optimized, Automated, Led, Implemented, Reduced, Increased).\n- Remove first person ("I", "my").\n- Insert realistic impact/scale placeholders if unknown (e.g., "by 15%", "for 10k+ users").\n- Mention relevant tools/tech if present.\n- Keep bullets 1 line each (max ~22 words).\n- Use past tense unless “Currently working here” is true.\n\nContext:\n- Company: ${company}\n- Title: ${title}\n- Currently working here: ${isCurrent}\n- Raw notes: """${rawNotes}"""\n- Tech stack (optional): ${techCsv}\n- Job description (optional): """${jobDescription || ''}"""\n\nOutput strictly as JSON array named "bullets".`
          const completion = await callOpenAIWithRetry(openai, [{ role: 'user', content: userPrompt }])
          const content = completion.choices?.[0]?.message?.content
          const parsed = tryParseJson<{ bullets?: string[] }>(content)
          if (parsed?.bullets && Array.isArray(parsed.bullets) && parsed.bullets.length > 0) {
            return NextResponse.json({ bullets: parsed.bullets.slice(0, 5) })
          }
        } catch (err) {
          safeLog('ALERT:CAREER_ASSIST_OAI_BULLETS_FAIL', { err: (err as any)?.message })
        }
      }

      // Fallback
      let baseBullets = Array.isArray(e?.bullets) ? e.bullets : []
      if (baseBullets.length === 0) baseBullets = extractSentences(rawNotes).slice(0, 5)
      const outBullets = optimizeForATS(baseBullets, jobDescription)
      return NextResponse.json({ bullets: outBullets })
    }

    if (mode === 'coverLetter') {
      const cvInput = CvSchema.parse(form)
      resp.coverLetter = generateCoverLetter(cvInput, body.targetRole, tone)
      const out = OutputSchema.parse(resp)
      safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
      return NextResponse.json(out)
    }

    if (mode === 'interviewPrep') {
      const cvInput = CvSchema.parse(form)
      resp.interviewQuestions = generateInterviewQuestions(cvInput)
      const out = OutputSchema.parse(resp)
      safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
      return NextResponse.json(out)
    }

    if (mode === 'optimize') {
      const cvInput = CvSchema.parse(form)
      if (process.env.OPENAI_API_KEY) {
        try {
          const { default: OpenAI } = await import('openai')
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const userPrompt = `Use the user’s current CV as input + optional job description.\nYou optimize CV content for ATS.\n\nRewrite the existing content ONLY (do not invent roles/companies). Improve clarity, verbs, and keyword coverage.\n\nRewrite rules:\n- Keep structure (personalInfo, education[], experience[], projects[], skills{…}).\n- Improve bullets: action verb first, quantify impact when possible, include role-relevant keywords.\n- Remove first-person phrasing.\n- Preserve dates and employers.\n- English unless locale = "ar" (MSA) or "kw" (Kuwaiti dialect).\n\nInputs:\n- locale: ${locale}\n- tone: ${tone}\n- job description (optional): """${jobDescription || ''}"""\n- cv (JSON): ${JSON.stringify(cvInput)}\n\nOutput JSON with the SAME structure, only with improved wording.`
          const completion = await callOpenAIWithRetry(openai, [{ role: 'user', content: userPrompt }])
          const content = completion.choices?.[0]?.message?.content
          const parsed = tryParseJson<{ personalInfo?: any; education?: any; experience?: any; projects?: any; skills?: any }>(content)
          if (parsed && Object.keys(parsed).length > 0) {
            resp.cv = parsed as any
            const out = OutputSchema.parse(resp)
            safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
            return NextResponse.json(out)
          }
        } catch (err) {
          safeLog('ALERT:CAREER_ASSIST_OAI_OPT_FAIL', { err: (err as any)?.message })
        }
      }
      // Fallback heuristic optimization
      const optimized: CVData = JSON.parse(JSON.stringify(cvInput))
      if (optimized.experience) {
        optimized.experience = optimized.experience.map((e) => {
          let baseBullets = Array.isArray(e.bullets) ? e.bullets : []
          if (baseBullets.length === 0) {
            const desc = guessDescriptionFromParsedCv(parsedCv)
            const seeds = extractSentences(desc).slice(0, 4)
            baseBullets = seeds.length > 0 ? seeds : baseBullets
          }
          return { ...e, bullets: optimizeForATS(baseBullets, jobDescription) }
        })
      }
      if (optimized.projects) optimized.projects = optimized.projects.map(p => ({ ...p, bullets: optimizeForATS(p.bullets || [], jobDescription) }))
      resp.cv = localizeCv(optimized, locale)
      if (!resp.cv || hasPlaceholdersLoose(resp.cv)) {
        return NextResponse.json({ error: 'INSUFFICIENT_INPUT', needs: resp.needs || [] }, { status: 422 })
      }
      const out = OutputSchema.parse(resp)
      safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
      return NextResponse.json(out)
    }

    // complete (default)
    const overrides = CvSchema.parse(form)
    if (process.env.OPENAI_API_KEY) {
      try {
        const { default: OpenAI } = await import('openai')
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const userPrompt = `You complete missing CV sections conservatively.\n\nRules:\n- DO NOT change factual items (names, dates, employers).\n- If a section is missing or very thin, add realistic, entry-level content aligned to field, skills, and job description.\n- Projects: 1–2 concise projects with bullets; Skills: grouped (Technical, Languages, Soft).\n- Summary: 2–3 lines, no buzzword soup; reflect candidate's field and skills.\n- English unless locale = "ar" or "kw".\n\nInputs:\n- locale: ${locale}\n- tone: ${tone}\n- job description (optional): """${jobDescription || ''}"""\n- cv (JSON, may be partial): ${JSON.stringify(overrides)}\n\nReturn ONLY the completed fields in JSON with the SAME schema.`
        const completion = await callOpenAIWithRetry(openai, [{ role: 'user', content: userPrompt }])
        const content = completion.choices?.[0]?.message?.content
        const parsed = tryParseJson<any>(content)
        if (parsed && Object.keys(parsed).length > 0) {
          resp.cv = parsed
          resp.careerSuggestions = generateCareerSuggestions(fieldOfStudy, areaOfInterest)
          const out = OutputSchema.parse(resp)
          safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
          return NextResponse.json(out)
        }
      } catch (err) {
        safeLog('ALERT:CAREER_ASSIST_OAI_COMPLETE_FAIL', { err: (err as any)?.message })
      }
    }

    // Fallback completion
    let cv = generateDefaultCV(fieldOfStudy, areaOfInterest, overrides)
    cv = localizeCv(cv, locale)
    resp.cv = cv
    if (!resp.cv || hasPlaceholdersLoose(resp.cv)) {
      return NextResponse.json({ error: 'INSUFFICIENT_INPUT', needs: resp.needs || [] }, { status: 422 })
    }
    resp.careerSuggestions = generateCareerSuggestions(fieldOfStudy, areaOfInterest)
    const out = OutputSchema.parse(resp)
    safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
    return NextResponse.json(out)

  } catch (error: any) {
    safeLog('ALERT:CAREER_ASSIST_ERROR', { error: error?.message, stack: error?.stack })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
