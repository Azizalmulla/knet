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

// Detect if any Arabic characters exist in provided inputs
function hasArabicInObject(obj: any): boolean {
  try {
    if (!obj) return false
    const AR_RE = /[\u0600-\u06FF]/
    const stack: any[] = [obj]
    while (stack.length) {
      const cur = stack.pop()
      if (typeof cur === 'string') {
        if (AR_RE.test(cur)) return true
      } else if (Array.isArray(cur)) {
        stack.push(...cur)
      } else if (cur && typeof cur === 'object') {
        stack.push(...Object.values(cur))
      }
    }
  } catch {}
  return false
}

function detectRequestedLang(form: any, parsedCv?: string, jobDescription?: string, fallback: 'en'|'ar'|'kw' = 'en'): 'en'|'ar' {
  try {
    if (fallback === 'ar') return 'ar'
    if (hasArabicInObject(form)) return 'ar'
    if (parsedCv && /[\u0600-\u06FF]/.test(parsedCv)) return 'ar'
    if (jobDescription && /[\u0600-\u06FF]/.test(jobDescription)) return 'ar'
  } catch {}
  return 'en'
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
  mode: z.enum(['complete','optimize','suggestRoles','coverLetter','interviewPrep','bullets','summary','master']).optional(),
  locale: z.enum(['en','ar','kw']).default('en'),
  tone: z.enum(['professional','creative','academic']).default('professional'),
  form: z.any().optional(),
  parsedCv: z.string().optional(),
  jobDescription: z.string().optional(),
  task: z.enum(['cv_drafting','section_completion','ats_optimization','career_suggestions','cover_letter','interview_prep']).optional(),
  cvData: z.any().optional(),
  fieldOfStudy: z.string().optional(),
  areaOfInterest: z.string().optional(),
  variant: z.enum(['shorter','stronger','more_keywords']).optional(),
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
  // Only enforce strict requirements for cover letters, where contact info is essential
  if (mode === 'coverLetter') {
    if (!pi.fullName) needs.push('personalInfo.fullName')
    if (!pi.email) needs.push('personalInfo.email')
  }
  // For summary/complete/optimize/bullets, proceed even if summary/name/email are missing — the model or fallback will handle it
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
    const mode: 'complete'|'optimize'|'suggestRoles'|'coverLetter'|'interviewPrep'|'bullets'|'summary'|'master' = body.mode || mapLegacyTaskToMode(body.task) || 'complete'
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

    // Master mode: return EXACT JSON as specified by the master prompt
    if (mode === 'master') {
      if (!process.env.OPENAI_API_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 503 })
      }
      try {
        const { default: OpenAI } = await import('openai')
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        const systemPrompt = `You are Smart AI Assist for a CV builder. You must support English and Arabic.

LANGUAGE RULES
- Detect the user’s language from input. If Arabic is detected anywhere (query or CV data), write the entire output in formal Modern Standard Arabic (MSA).
- For Arabic output:
  - Use professional CV tone (concise, no colloquial).
  - Keep dates as YYYY-MM (ATS-friendly), e.g., 2024-09.
  - Use Western digits (0-9) for numbers/percentages.
  - Section headers:
    Professional Summary = الملخص المهني
    Education = التعليم
    Experience = الخبرة العملية
    Projects = المشاريع
    Skills = المهارات
    Languages = اللغات
    Certifications = الشهادات
    Awards = الجوائز

CONTENT RULES
- Improve and COMPLETE the CV: expand sparse sections with strong bullet points (action verb + what + tech + outcome; add metrics only if inferable).
- Keep all factual user details (names, dates, degrees). Do NOT invent employers, dates, or credentials.
- If work experience is thin, add PROJECTS (academic/personal), not fake jobs.
- GPA: show the user’s actual GPA if provided; if missing, use "N/A".
- Produce an evidence-based candidate_score (0–100) using this rubric:
  Experience impact/leadership: 35
  Projects relevance/complexity: 25
  Skills relevance/depth: 20
  Education strength (degree, GPA, honors): 10
  Certifications/Awards: 10
  (Deduct proportionally when evidence is missing; never guess.)

OUTPUT FORMAT (return ONLY this JSON)
{
  "displayGPA": "string",
  "candidate_score": number,
  "score_reasons": ["short, evidence-based bullets…"],
  "cv": {
    "summary": "string",
    "education": [{"degree":"string","org":"string","start":"YYYY-MM?","end":"YYYY-MM?","gpa":"string?"}],
    "experience": [{"title":"string","company":"string","start":"YYYY-MM?","end":"YYYY-MM?","location":"string?","bullets":["string"]}],
    "projects": [{"name":"string","role":"string?","tech":["string"],"start":"YYYY-MM?","end":"YYYY-MM?","bullets":["string"]}],
    "skills": {"technical":["string"],"frameworks":["string"],"tools":["string"],"databases":["string"],"cloud":["string"],"languages":["string"],"soft":["string"]},
    "certifications": ["string"],
    "awards": ["string"],
    "languages": ["string"]
  }
}`

        // Few-shot examples
        const fewShotUserEN = `{"lang":"en","targetRole":"Backend Intern","education":[{"degree":"B.Sc. CS","org":"GUST","end":"2025-06","gpa":"3.6"}],"experience":[],"projects":[{"name":"Task API","tech":["Node","Postgres"],"bullets":["Auth, CRUD, pagination"]}],"skills":{"technical":["JavaScript"],"frameworks":["Node"],"tools":["Git"]},"languages":["English","Arabic"]}`
        const fewShotAssistantEN = `{"displayGPA":"3.6","candidate_score":68,"score_reasons":["+ Relevant API project","- No internships yet"],"cv":{"summary":"...","education":[{"degree":"B.Sc. CS","org":"GUST","end":"2025-06","gpa":"3.6"}],"experience":[],"projects":[{"name":"Task API","tech":["Node","Postgres"],"bullets":["Built REST API with auth and pagination","Deployed on Render; monitored logs","Wrote SQL queries and indices"]}],"skills":{"technical":["JavaScript","SQL"],"frameworks":["Node","Express"],"tools":["Git","Postman"],"databases":["Postgres"],"cloud":[],"languages":["English","Arabic"],"soft":["Problem Solving"]},"certifications":[],"awards":[],"languages":["English","Arabic"]}}`
        const fewShotUserAR = `{"lang":"ar","targetRole":"مطوّر واجهات أمامية","education":[{"degree":"بكالوريوس علوم الحاسب","org":"جامعة الكويت","end":"2025-06","gpa":"3.4"}],"experience":[],"projects":[{"name":"متجر إلكتروني","tech":["React","Next.js"],"bullets":["عرض المنتجات وسلة الشراء"]}],"skills":{"technical":["JavaScript"],"frameworks":["React"],"tools":["Git"]},"languages":["العربية","الإنجليزية"]}`
        const fewShotAssistantAR = `{"displayGPA":"3.4","candidate_score":72,"score_reasons":["+ مشروع واجهات أمامية ملائم","- خبرة عملية محدودة"],"cv":{"summary":"مطوّر واجهات أمامية يركّز على بناء تجارب استخدام سريعة الاستجابة...","education":[{"degree":"بكالوريوس علوم الحاسب","org":"جامعة الكويت","end":"2025-06","gpa":"3.4"}],"experience":[],"projects":[{"name":"متجر إلكتروني","tech":["React","Next.js"],"bullets":["بناء صفحات منتجات قابلة للبحث والتصفية","تنفيذ إدارة حالة للسلة والدفع الوهمي","تحسين الأداء عبر تقسيم الشيفرة والتحميل الكسول"]}],"skills":{"technical":["JavaScript","HTML","CSS"],"frameworks":["React","Next.js"],"tools":["Git","Vite"],"databases":[],"cloud":[],"languages":["العربية","الإنجليزية"],"soft":["حل المشكلات","التواصل"]},"certifications":[],"awards":[],"languages":["العربية","الإنجليزية"]}}`

        const requestedLang = detectRequestedLang(form, parsedCv, jobDescription, locale)
        const inputPayload = {
          lang: requestedLang === 'ar' ? 'ar' : 'en',
          targetRole: body?.targetRole || (areaOfInterest || 'Student'),
          form: form || {},
          jobDescription: jobDescription || ''
        }

        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: fewShotUserEN },
          { role: 'assistant' as const, content: fewShotAssistantEN },
          { role: 'user' as const, content: fewShotUserAR },
          { role: 'assistant' as const, content: fewShotAssistantAR },
          { role: 'user' as const, content: JSON.stringify(inputPayload) },
        ]

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.4,
          max_tokens: 2200,
          response_format: { type: 'json_object' },
        })
        let content = completion.choices?.[0]?.message?.content
        let parsed = tryParseJson<any>(content ?? undefined)

        if (requestedLang === 'ar') {
          const emptyExp = !parsed?.cv?.experience || parsed.cv.experience.length === 0
          const emptyProj = !parsed?.cv?.projects || parsed.cv.projects.length === 0
          if (emptyExp && emptyProj) {
            const reprompt = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'assistant', content: JSON.stringify(parsed || {}) },
                { role: 'user', content: 'Expand projects/experience; keep Arabic MSA; same schema.' },
              ],
              temperature: 0.4,
              max_tokens: 1200,
              response_format: { type: 'json_object' },
            })
            content = reprompt.choices?.[0]?.message?.content
            parsed = tryParseJson<any>(content ?? undefined) || parsed
          }
        }

        if (parsed && typeof parsed === 'object') {
          return NextResponse.json(parsed)
        }
        return NextResponse.json({ error: 'Model returned empty response' }, { status: 502 })
      } catch (err) {
        safeLog('ALERT:CAREER_ASSIST_OAI_MASTER_FAIL', { err: (err as any)?.message })
        return NextResponse.json({ error: 'Failed to generate output' }, { status: 502 })
      }
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
          const parsed = tryParseJson<{ bullets?: string[] }>(content ?? undefined)
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

    // Summary generation
    if (mode === 'summary') {
      const pi = (form?.personalInfo || {}) as any
      const skills = (form?.skills || {}) as any
      const topSkills: string[] = ([] as string[])
        .concat(Array.isArray(skills.programmingLanguages) ? skills.programmingLanguages : [])
        .concat(Array.isArray((skills as any).technical) ? (skills as any).technical : [])
        .slice(0, 6)
      const degree = form?.education?.[0]?.degree || ''

      const variantHint = body.variant || 'default'

      const makeOut = (summary: string) => {
        const tidy = (s: string) => {
          let out = (s || '').trim().replace(/\s+/g, ' ')
          if (!out) return out
          if (!/[.!?]$/.test(out)) out += '.'
          return out
        }
        const cleaned = tidy(summary)
        resp.cv = { personalInfo: { summary: cleaned } } as any
        const out = OutputSchema.parse(resp)
        safeLog('ALERT:CAREER_ASSIST', { mode, locale, duration: Date.now()-started, needs: out.needs?.length || 0 })
        return NextResponse.json(out)
      }

      // Use OpenAI when available
      if (process.env.OPENAI_API_KEY) {
        try {
          const { default: OpenAI } = await import('openai')
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
          const vMap: Record<string,string> = {
            shorter: 'Prefer 25–40 words and tighter verbs.',
            stronger: 'Keep length but upgrade verbs and quantify impact when appropriate.',
            more_keywords: 'Include 3–5 relevant role/tech keywords from skills/JD without stuffing.',
            default: 'Target 35–60 words with balanced concision and clarity.'
          }
          const localeHint = locale === 'ar' ? 'Write in Modern Standard Arabic (MSA).' : locale === 'kw' ? 'Write in Kuwaiti Arabic dialect (ar-KW) keeping tech terms recognizable.' : 'Write in English.'
          const userPrompt = `You are a CV summary assistant. Output a single paragraph summary as JSON {"summary": "..."}.
Rules:
- One paragraph, 35–60 words (target ~45). ${vMap[variantHint]}
- No first-person pronouns (no "I", "my", "we").
- Use role-neutral, action-oriented phrasing.
- Prefer measurable impact if hinted.
- Insert 2–4 relevant keywords from skills/JD (no stuffing).
- No placeholders or fabricated personal info.
- ${localeHint}

Inputs:
- Name: ${pi.fullName || ''}
- Current summary: """${(pi.summary || '').slice(0, 500)}"""
- Degree: ${degree}
- Top skills: ${topSkills.join(', ')}
- Job description (optional): """${jobDescription || ''}"""

Output: JSON object with key "summary" only.`
          const completion = await callOpenAIWithRetry(openai, [{ role: 'user', content: userPrompt }])
          const content = completion.choices?.[0]?.message?.content
          const parsed = tryParseJson<{ summary?: string }>(content ?? undefined)
          if (parsed?.summary && typeof parsed.summary === 'string') {
            return makeOut(parsed.summary)
          }
        } catch (err) {
          safeLog('ALERT:CAREER_ASSIST_OAI_SUMMARY_FAIL', { err: (err as any)?.message })
        }
      }

      // Fallback heuristic
      const base = (pi.summary || '').trim()
      const baseSkills = topSkills.slice(0, 4)
      const jdHint = (jobDescription || '').split(/\s+/).slice(0, 30).join(' ')
      let out = base
      if (!out) {
        out = `${pi.fullName ? 'Results-driven candidate' : 'Results-driven graduate'} with foundation in ${degree || 'software development'}, skilled in ${baseSkills.join(', ')}. Focused on delivering measurable impact and collaborating in agile teams to ship features reliably.`
      }
      if (variantHint === 'shorter') {
        const words = out.split(/\s+/)
        out = words.slice(0, Math.min(40, words.length)).join(' ')
      } else if (variantHint === 'stronger') {
        out = out.replace(/^\w+\s/, 'Driven ').replace(/(worked on|helped)/gi, 'delivered')
      } else if (variantHint === 'more_keywords') {
        const extra = baseSkills.slice(0, 3).join(', ')
        out += extra ? ` Keywords: ${extra}.` : ''
      }
      return makeOut(out)
    }

    if (mode === 'optimize') {
      const cvInput = CvSchema.parse(form)
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

        const systemPrompt = `You are Smart AI Assist for a CV builder.\nGoal: Turn sparse student inputs into a complete, professional, ATS-friendly resume ready for PDF export.\nDo both: complete missing content and improve existing wording.\n\nRules\n- Keep all factual user details (names, dates, degrees) unchanged.\n- Do not invent employers, dates, or credentials.\n- If work experience is thin, create relevant academic or personal Projects (not fake jobs).\n- For bullets, use action verb + what you did + tech + outcome. Use metrics only if implied; otherwise use scope/scale (e.g., “built REST API used by 3 modules”).\n- Organize Skills into groups: technical, frameworks, tools, databases, cloud, languages, soft.\n- Always include these sections when possible: summary, education, experience or projects, skills, languages, and add certifications / awards if provided or clearly inferable from inputs.\n- Tone: concise, professional, recruiter-friendly. No fluff, no first-person.\n- Target density: 3–5 bullets per role/project; 1–2 pages total content.\n- Output valid JSON matching the schema below. No extra text.\n\nOutput JSON schema\n{\n  "summary": "string",\n  "education": [{"degree":"string","org":"string","start":"YYYY-MM?","end":"YYYY-MM?","gpa":"string?"}],\n  "experience": [{"title":"string","company":"string","start":"YYYY-MM?","end":"YYYY-MM?","location":"string?","bullets":["string", "..."]}],\n  "projects": [{"name":"string","role":"string?","tech":["string"],"start":"YYYY-MM?","end":"YYYY-MM?","bullets":["string","..."]}],\n  "skills": {"technical":["string"],"frameworks":["string"],"tools":["string"],"databases":["string"],"cloud":["string"],"languages":["string"],"soft":["string"]},\n  "certifications": ["string"],\n  "awards": ["string"],\n  "languages": ["string"]\n}\nIf a section is empty, return an empty array for it (don’t omit keys). Respect the requested language (EN/AR). For AR use formal MSA tone.`

        const inputPayload = {
          lang: locale,
          targetRole: body?.targetRole || (areaOfInterest || 'Student'),
          jobDescription: jobDescription || '',
          personal: {
            name: overrides?.personalInfo?.fullName || '',
            email: overrides?.personalInfo?.email || '',
            phone: overrides?.personalInfo?.phone || '',
            location: overrides?.personalInfo?.location || ''
          },
          education: (overrides?.education || []).map((e: any) => ({
            degree: e?.degree || '',
            org: e?.institution || e?.org || '',
            start: e?.startDate || '',
            end: e?.endDate || e?.graduationDate || '',
            gpa: e?.gpa || undefined,
          })),
          experience: (overrides?.experience || []).map((e: any) => ({
            title: e?.title || e?.position || '',
            company: e?.company || '',
            start: e?.startDate || '',
            end: e?.endDate || '',
            location: e?.location || '',
            bullets: Array.isArray(e?.bullets) ? e.bullets : [],
          })),
          projects: (overrides?.projects || []).map((p: any) => ({
            name: p?.name || '',
            role: p?.role || '',
            tech: Array.isArray(p?.technologies) ? p.technologies : [],
            start: p?.startDate || '',
            end: p?.endDate || '',
            bullets: Array.isArray(p?.bullets) ? p.bullets : [],
          })),
          skills: {
            technical: Array.isArray((overrides?.skills as any)?.technical) ? (overrides?.skills as any).technical : (Array.isArray((overrides?.skills as any)?.programmingLanguages) ? (overrides?.skills as any).programmingLanguages : []),
            frameworks: Array.isArray((overrides?.skills as any)?.frameworksLibraries) ? (overrides?.skills as any).frameworksLibraries : [],
            tools: Array.isArray((overrides?.skills as any)?.toolsPlatforms) ? (overrides?.skills as any).toolsPlatforms : [],
            databases: Array.isArray((overrides?.skills as any)?.databases) ? (overrides?.skills as any).databases : [],
            cloud: [],
            languages: Array.isArray((overrides?.skills as any)?.languages) ? (overrides?.skills as any).languages : [],
            soft: Array.isArray((overrides?.skills as any)?.soft || (overrides?.skills as any)?.softSkills) ? ((overrides?.skills as any).soft || (overrides?.skills as any).softSkills) : [],
          },
          areaOfInterest: areaOfInterest || '',
          template: (overrides as any)?.template || 'minimal'
        }

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(inputPayload) },
          ],
          temperature: 0.4,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        })
        const content = completion.choices?.[0]?.message?.content
        const parsed = tryParseJson<any>(content ?? undefined)
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
