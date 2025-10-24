import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'

const JOB_SEARCH_DEBUG = process.env.JOB_SEARCH_DEBUG === '1'
const debugLog = (...args: any[]) => {
  if (JOB_SEARCH_DEBUG) console.log('[job-search]', ...args)
}

function prepareQueries(candidates: string[], userInput: string, lang: 'en'|'ar'): string[] {
  const locationWord = lang === 'ar' ? 'الكويت' : 'Kuwait'
  const normalized = new Set<string>()
  const baseList = candidates.length ? candidates : [userInput]

  for (const raw of baseList) {
    const collapsed = collapseWhitespace(raw)
    if (!collapsed) continue
    let base = collapsed
    if (!new RegExp(locationWord, 'i').test(base)) base = `${base} ${locationWord}`
    normalized.add(base)

    const role = collapseWhitespace(base
      .replace(new RegExp(locationWord, 'ig'), ' ')
      .replace(/\b(jobs?|job|roles?|positions?|opportunities|vacancies|in|for|remote|near|full[-\s]?time|part[-\s]?time|دوام|وظائف|وظيفة)\b/gi, ' ')
      .trim())

    if (!role) continue

    if (lang === 'en') {
      normalized.add(`${role} job ${locationWord}`)
      normalized.add(`${role} jobs in ${locationWord}`)
      normalized.add(`${role} opportunities in ${locationWord}`)
      normalized.add(`latest ${role} jobs in ${locationWord}`)
      normalized.add(`${role} hiring now ${locationWord}`)
      normalized.add(`${role} openings ${locationWord}`)
    } else {
      normalized.add(`${role} في ${locationWord}`)
    }

    const variants = getRoleVariants(role.toLowerCase(), lang)
    for (const variant of variants) {
      const variantBase = `${variant} ${locationWord}`
      normalized.add(variantBase)
      if (lang === 'en') {
        normalized.add(`${variant} jobs in ${locationWord}`)
      }
    }
  }

  return Array.from(normalized).slice(0, 7)
}

function extractRoleTokens(rawInput: string | undefined, queries: string[]): string[] {
  const tokens = new Set<string>()
  const sources = [...queries]
  if (rawInput) sources.push(rawInput)
  for (const source of sources) {
    const parts = source.toLowerCase().split(/[^a-zA-Z\u0600-\u06FF]+/).filter(Boolean)
    for (const part of parts) {
      if (part.length < 3) continue
      if (GENERIC_TOKENS.has(part)) continue
      tokens.add(part)
    }
  }
  return Array.from(tokens).slice(0, 6)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const GENERIC_TOKENS = new Set<string>([
  'job','jobs','kuwait','latest','hiring','openings','opportunities','in','now','today','remote','full','part','time','fulltime','parttime','full-time','part-time','opportunity','careers','career','vacancy','vacancies','role','roles','position','positions'
])

function getRoleVariants(roleLower: string, lang: 'en'|'ar'): string[] {
  if (lang === 'ar') return []
  const matches: string[] = []
  for (const [key, options] of Object.entries(ROLE_VARIANT_MAP)) {
    const pattern = new RegExp(`\\b${escapeRegex(key)}\\b`)
    if (pattern.test(roleLower)) matches.push(...options)
  }
  return matches
}

function parsePostedTimestamp(value: string | undefined, now: number): number | null {
  if (!value) return null
  const text = collapseWhitespace(value)?.toLowerCase()
  if (!text) return null

  if (/30\+\s+days\s+ago/.test(text)) return now - (60 * MS_PER_DAY)

  const relativeMatch = text.match(/(\d+)\s+(hour|day|week|month|year)s?\s+ago/)
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]) || 0
    const unit = relativeMatch[2]
    const multipliers: Record<string, number> = {
      hour: MS_PER_DAY / 24,
      day: MS_PER_DAY,
      week: MS_PER_DAY * 7,
      month: MS_PER_DAY * 30,
      year: MS_PER_DAY * 365,
    }
    const ms = multipliers[unit] * amount
    return now - ms
  }

  const dated = Date.parse(text)
  if (!Number.isNaN(dated)) return dated

  return null
}

function isLikelyStale(job: JobResult, now: number): boolean {
  const sources = [job.postedAt, job.snippet, job.title]
  for (const source of sources) {
    const ts = parsePostedTimestamp(source, now)
    if (ts !== null) {
      const ageDays = (now - ts) / MS_PER_DAY
      if (ageDays > MAX_POST_AGE_DAYS) return true
      if (ageDays >= 0) return false
    }
  }
  return false
}

const InputSchema = z.object({
  q: z.string().min(2),
  lang: z.enum(['en','ar']).optional(),
  sessionId: z.string().min(5).max(128).optional(),
})

type JobResult = { title: string; url: string; source: string; snippet?: string; company?: string; location?: string; salary?: string; employmentType?: string; postedAt?: string }

type SessionRecord = { results: JobResult[]; updatedAt: number }
type DetailRecord = { salary?: string; employmentType?: string; postedAt?: string; fetchedAt: number }

const SESSION_TTL = 60 * 60 * 1000 // 1 hour
const DETAIL_TTL = 6 * 60 * 60 * 1000 // 6 hours

const sessionStore: Map<string, SessionRecord> = (() => {
  const g = globalThis as any
  if (!g.__JOB_SESSION_STORE) g.__JOB_SESSION_STORE = new Map<string, SessionRecord>()
  return g.__JOB_SESSION_STORE as Map<string, SessionRecord>
})()

const detailCache: Map<string, DetailRecord> = (() => {
  const g = globalThis as any
  if (!g.__JOB_DETAIL_CACHE) g.__JOB_DETAIL_CACHE = new Map<string, DetailRecord>()
  return g.__JOB_DETAIL_CACHE as Map<string, DetailRecord>
})()

function pruneStores(now = Date.now()) {
  for (const [key, record] of sessionStore) {
    if (now - record.updatedAt > SESSION_TTL) sessionStore.delete(key)
  }
  for (const [key, record] of detailCache) {
    if (now - record.fetchedAt > DETAIL_TTL) detailCache.delete(key)
  }
}

function getSessionResults(sessionId?: string): JobResult[] | null {
  if (!sessionId) return null
  const now = Date.now()
  pruneStores(now)
  const record = sessionStore.get(sessionId)
  if (!record) return null
  if (now - record.updatedAt > SESSION_TTL) {
    sessionStore.delete(sessionId)
    return null
  }
  return record.results
}

function saveSessionResults(sessionId: string | undefined, results: JobResult[]) {
  if (!sessionId) return
  pruneStores()
  sessionStore.set(sessionId, { results: results.slice(0, 20), updatedAt: Date.now() })
}

function collapseWhitespace(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  return value.replace(/\s+/g, ' ').trim()
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
}

function extractMetadataFromText(text: string): Partial<JobResult> {
  const normalized = collapseWhitespace(text)
  if (!normalized) return {}
  const lower = normalized.toLowerCase()
  const result: Partial<JobResult> = {}

  const salaryPatterns = [
    /(salary[^:]{0,15}[:\-]?\s*)([^.;\n]+)/i,
    /(?:kwd|kd|دينار)\s*(?:[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)(?:\s*(?:-|to)\s*(?:[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?))?(?:\s*(?:per|\/)?\s*(?:month|year|week|hour|month|annum|شهري|سنوي))?/i,
    /(?:[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?)(?:\s*(?:-|to)\s*(?:[0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?))?\s*(?:kwd|kd|دينار)/i,
  ]
  for (const regex of salaryPatterns) {
    const m = normalized.match(regex)
    if (m) {
      const candidate = collapseWhitespace(m.length > 2 ? m[2] : m[0])
      if (candidate && candidate.length <= 80) {
        result.salary = candidate
        break
      }
    }
  }

  const employmentPatterns: [RegExp, string][] = [
    [/full[\s-]?time/i, 'Full-time'],
    [/part[\s-]?time/i, 'Part-time'],
    [/contract/i, 'Contract'],
    [/temporary/i, 'Temporary'],
    [/internship|intern/i, 'Internship'],
    [/remote(?:\s+work)?/i, 'Remote'],
    [/hybrid/i, 'Hybrid'],
    [/on[-\s]?site/i, 'On-site'],
    [/دوام\s+كامل/u, 'دوام كامل'],
    [/دوام\s+جزئي/u, 'دوام جزئي'],
    [/عقد/u, 'عقد'],
    [/تدريب/u, 'تدريب']
  ]
  for (const [regex, label] of employmentPatterns) {
    if (regex.test(normalized)) {
      result.employmentType = label
      break
    }
  }

  const postedPatterns = [
    /posted\s+(?:on\s+)?([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /posted\s+(\d+\s+(?:hour|day|week|month|year)s?\s+ago)/i,
    /date\s+posted\s*[:\-]\s*([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /تم\s+النشر\s+في\s+([0-9]{1,2}\s+[^\s]+\s+\d{4})/iu,
    /منذ\s+(\d+\s+يوم(?:اً)?|\d+\s+ساعة|\d+\s+أسبوع)/u,
  ]
  for (const regex of postedPatterns) {
    const m = normalized.match(regex)
    if (m) {
      const candidate = collapseWhitespace(m[1] || m[0])
      if (candidate && candidate.length <= 60) {
        result.postedAt = candidate
        break
      }
    }
  }

  if (!result.salary) {
    const idx = lower.indexOf('salary')
    if (idx !== -1) {
      const fragment = collapseWhitespace(normalized.slice(idx, idx + 80))
      if (fragment) result.salary = fragment
    }
  }

  return result
}

async function fetchJobDetails(url: string): Promise<Partial<JobResult>> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIJobFinder/1.0; +https://cv-saas.vercel.app)',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
      },
      redirect: 'follow',
      cache: 'no-store',
    })
    if (!res.ok) return {}
    const html = await res.text()
    const plain = stripHtml(html)
    const truncated = plain.length > 60000 ? plain.slice(0, 60000) : plain
    const metadata = extractMetadataFromText(truncated)
    return metadata
  } catch {
    return {}
  }
}

async function enrichResults(results: JobResult[]): Promise<JobResult[]> {
  if (!results.length) return results
  const now = Date.now()
  const enriched = await Promise.all(results.map(async (job, index) => {
    const baseMetadata = extractMetadataFromText(job.snippet || '')
    let merged: JobResult = { ...job, ...baseMetadata }
    const cached = detailCache.get(job.url)
    if (cached && now - cached.fetchedAt <= DETAIL_TTL) {
      merged = { ...merged, ...cached }
      return merged
    }
    const needsMore = !merged.salary || !merged.employmentType || !merged.postedAt
    if (!needsMore || index >= 5) return merged
    const fetched = await fetchJobDetails(job.url)
    const details = { ...fetched }
    if (Object.keys(details).length) {
      detailCache.set(job.url, { ...details, fetchedAt: Date.now() })
      merged = { ...merged, ...details }
    }
    return merged
  }))
  return enriched.map(trimNoise)
}

function respondFromSession(results: JobResult[], query: string, lang: 'en'|'ar'): { answer: string; results: JobResult[] } | null {
  if (!results.length) return null
  const lowerQuery = query.toLowerCase()
  const wantsSalary = /(salary|pay|compensation|راتب|الراتب|أجر)/i.test(query)
  const wantsType = /(employment|contract|full[-\s]?time|part[-\s]?time|دوام|نوع\s+الوظيفة)/i.test(query)
  const wantsPosted = /(posted|date|when|متى|تم\s+النشر|منذ)/i.test(query)
  const wantsLocation = /(where|location|city|أين|المكان)/i.test(query)
  if (!(wantsSalary || wantsType || wantsPosted || wantsLocation)) return null

  const matchedByCompany = results.filter(r => r.company && lowerQuery.includes(r.company.toLowerCase()))
  const target = matchedByCompany.length ? matchedByCompany : results
  const candidates = target.filter(r => (
    (wantsSalary && r.salary) ||
    (wantsType && r.employmentType) ||
    (wantsPosted && r.postedAt) ||
    (wantsLocation && r.location)
  ))
  if (!candidates.length) return null

  const formatter = (job: JobResult): string => {
    const titlePart = job.company ? `${job.title} — ${job.company}` : job.title
    const details: string[] = []
    if (wantsSalary) details.push(lang === 'ar' ? `الراتب: ${job.salary || 'غير مذكور'}` : `Salary: ${job.salary || 'Not listed'}`)
    if (wantsType) details.push(lang === 'ar' ? `نوع العمل: ${job.employmentType || 'غير مذكور'}` : `Employment: ${job.employmentType || 'Not specified'}`)
    if (wantsPosted) details.push(lang === 'ar' ? `تاريخ النشر: ${job.postedAt || 'غير متوفر'}` : `Posted: ${job.postedAt || 'Not available'}`)
    if (wantsLocation && job.location) details.push(lang === 'ar' ? `الموقع: ${job.location}` : `Location: ${job.location}`)
    const tail = details.length ? details.join(' • ') : (lang === 'ar' ? 'لا توجد تفاصيل إضافية.' : 'No additional details available.')
    return `- ${titlePart}: ${tail}`
  }

  const lines = candidates.slice(0, 5).map(formatter)
  const header = lang === 'ar' ? 'إليك التفاصيل المتوفرة:' : 'Here are the details I have:'
  const answer = [header, ...lines].join('\n')
  return { answer, results: candidates }
}
function isClosedPosting(r: JobResult): boolean {
  const text = `${r.title} ${r.snippet || ''}`.toLowerCase()
  return /job closed|position closed|role closed|applications closed|posting closed|no longer accepting|no longer available|posting expired|job expired|applications are closed/.test(text)
}

function computeScore(r: JobResult, now?: number): number {
  let host = ''
  try {
    host = new URL(r.url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {}
  const base = HOST_PRIORITY[host] ?? 5
  const noCompanyPenalty = r.company ? 0 : 1
  const listingPenalty = isListingPage(r.title, r.url) ? 2 : 0
  
  // Recency bonus: lower score for newer jobs
  let recencyBonus = 0
  if (now) {
    const sources = [r.postedAt, r.snippet, r.title]
    for (const source of sources) {
      const ts = parsePostedTimestamp(source, now)
      if (ts !== null) {
        const ageDays = (now - ts) / MS_PER_DAY
        if (ageDays >= 0 && ageDays <= 7) {
          recencyBonus = -2 // Strong bonus for jobs posted in the last week
        } else if (ageDays > 7 && ageDays <= 14) {
          recencyBonus = -1 // Moderate bonus for jobs posted in the last 2 weeks
        }
        break
      }
    }
  }
  
  return base + noCompanyPenalty + listingPenalty + recencyBonus
}

function trimNoise(job: JobResult): JobResult {
  const sanitize = (value?: string) => {
    if (!value) return value
    const cleaned = collapseWhitespace(value.replace(/not specified/ig, '').replace(/غير مذكور/ig, '').replace(/محجوب/ig, ''))
    return cleaned || undefined
  }
  return {
    ...job,
    salary: sanitize(job.salary),
    employmentType: sanitize(job.employmentType),
    postedAt: sanitize(job.postedAt),
  }
}

function relevanceScore(query: string, job: JobResult): number {
  const q = query.toLowerCase()
  const fields = [job.title, job.company, job.snippet, job.location].map(f => (f || '').toLowerCase())
  let hits = 0
  const tokens = q.split(/[^a-zA-Z\u0600-\u06FF]+/).filter(Boolean)
  for (const token of tokens) {
    if (token.length < 3) continue
    if (GENERIC_TOKENS.has(token)) continue
    if (fields.some(field => field.includes(token))) hits += 1
  }
  return hits
}

function applyRelevanceFilter(query: string, jobs: JobResult[], roleTokens: string[]): JobResult[] {
  if (!jobs.length) return jobs
  const tokens = roleTokens.length ? new Set(roleTokens) : null
  const scored = jobs.map(job => {
    const baseScore = relevanceScore(query, job)
    let penalty = 0
    if (tokens) {
      const haystack = `${job.title} ${job.snippet || ''} ${job.company || ''}`.toLowerCase()
      let hits = 0
      tokens.forEach(token => { if (haystack.includes(token)) hits += 1 })
      if (!hits) penalty = 2
      else if (hits < Math.min(tokens.size, 2)) penalty = 1
    }
    return { job, score: Math.max(0, baseScore - penalty) }
  })
  const maxScore = scored.reduce((max, item) => Math.max(max, item.score), 0)
  if (maxScore === 0) return jobs
  const threshold = Math.max(1, maxScore - 1)
  const filtered = scored.filter(item => item.score >= threshold)
  return filtered.length ? filtered.map(item => item.job) : jobs
}

async function extractSearchQueries(userInput: string, lang: 'en'|'ar'): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return [userInput]
  
  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey })
    const model = process.env.JOB_BOT_MODEL || 'gpt-4o-mini'
    
    const sys = lang === 'ar'
      ? 'أنت مساعد بحث وظائف. استخرج 2-3 استعلامات بحث مُحسّنة من طلب المستخدم. أعد JSON فقط بصيغة {"queries": ["استعلام1", "استعلام2"]}. لا تضف نصًا إضافيًا.'
      : 'You are a job search assistant. Extract 2-3 optimized search queries from the user request. Return only JSON: {"queries": ["query1", "query2"]}. No extra text.'
    
    const u = lang === 'ar'
      ? `طلب المستخدم: "${userInput}"\n\nاستخرج استعلامات بحث وظائف واضحة ومحددة (مثل: "مهندس برمجيات"، "محاسب مبتدئ"، "تسويق رقمي"). أعد JSON فقط.`
      : `User request: "${userInput}"\n\nExtract clear, specific job search queries (e.g., "software engineer", "junior accountant", "digital marketing"). Return JSON only.`
    
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 150,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: u },
      ],
    })
    
    const content = completion.choices?.[0]?.message?.content?.trim() || '{}'
    const parsed = JSON.parse(content)
    const queries: string[] = Array.isArray(parsed.queries) ? parsed.queries.filter((q: any) => typeof q === 'string' && q.length > 0) : []
    return prepareQueries(queries.length ? queries : [userInput], userInput, lang)
  } catch {
    return prepareQueries([userInput], userInput, lang)
  }
}

const PRIMARY_SITE_CLAUSE = 'site:bayt.com OR site:linkedin.com OR site:kw.indeed.com OR site:indeed.com.kw OR site:indeed.com'

const PRIMARY_TAVILY_DOMAINS = ['bayt.com','linkedin.com','indeed.com','kw.indeed.com','indeed.com.kw']

const ROLE_VARIANT_MAP: Record<string, string[]> = {
  'marketing': ['marketing specialist', 'marketing manager', 'digital marketing'],
  'software engineer': ['software developer', 'software engineering', 'backend developer'],
  'software developer': ['software engineer', 'backend developer', 'full stack developer'],
  'cs internship': ['computer science internship', 'software engineering internship', 'cs intern'],
  'computer science internship': ['cs internship', 'software engineering internship'],
  'it support': ['help desk', 'technical support', 'desktop support'],
  'data analyst': ['business analyst', 'data scientist'],
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAX_POST_AGE_DAYS = 30

const ATS_HOST_PATTERNS: RegExp[] = [
  /\.greenhouse\.io$/,
  /\.lever\.co$/,
  /\.myworkdayjobs\.com$/,
  /\.successfactors\.com$/,
  /\.smartrecruiters\.com$/,
  /\.workable\.com$/,
  /\.bamboohr\.com$/,
  /\.icims\.com$/,
  /\.jobvite\.com$/,
  /\.recruitee\.com$/,
  /\.eightfold\.ai$/,
  /\.applytojob\.com$/,
  /\.talentify\.io$/,
  /\.ultipro\.com$/,
  /\.adp\.com$/,
]

const HOST_PRIORITY: Record<string, number> = {
  'bayt.com': 0,
  'people.bayt.com': 0,
  'linkedin.com': 1,
  'kw.linkedin.com': 1,
  'indeed.com': 2,
  'kw.indeed.com': 2,
  'indeed.com.kw': 2,
}

async function searchWithQueries(queries: string[], userInput: string, lang: 'en'|'ar'): Promise<JobResult[]> {
  const gathered: JobResult[] = []
  const roleTokens = extractRoleTokens(userInput, queries)

  const collect = async (clause?: string, opts?: { allowListings?: boolean }) => {
    for (const q of queries) {
      const withKW = q.includes('Kuwait') || q.includes('الكويت') ? q : (lang === 'ar' ? `${q} الكويت` : `${q} Kuwait`)
      const scopedQ = clause ? `${withKW} (${clause})` : withKW

      let part = await searchCSE(scopedQ, lang, opts)
      debugLog('cse-results', { query: scopedQ, count: part.length, allowListings: Boolean(opts?.allowListings) })
      if (!part.length) {
        const domains = clause ? PRIMARY_TAVILY_DOMAINS : undefined
        part = await searchTavily(scopedQ, domains, opts)
        debugLog('tavily-results', { query: scopedQ, count: part.length, allowListings: Boolean(opts?.allowListings) })
      }
      debugLog('stage-results', { clause: clause || 'broad', query: scopedQ, count: part.length, allowListings: Boolean(opts?.allowListings) })
      if (part.length) gathered.push(...part)
      const limit = opts?.allowListings ? 30 : 20
      if (gathered.length >= limit) break
    }
  }

  await collect(PRIMARY_SITE_CLAUSE)
  if (gathered.length < 5) await collect(undefined)

  let filtered = filterAndDedupe(gathered)

  if (filtered.length < 3) {
    await collect(PRIMARY_SITE_CLAUSE, { allowListings: true })
    if (gathered.length < 5) await collect(undefined, { allowListings: true })

    const listings = filterAndDedupe(gathered, { allowListings: true })
    if (!filtered.length) {
      filtered = listings
    } else if (listings.length) {
      const seen = new Set(filtered.map(r => r.url.split('?')[0]))
      for (const item of listings) {
        const key = item.url.split('?')[0]
        if (!seen.has(key)) {
          filtered.push(item)
          seen.add(key)
        }
      }
    }
  }

  if (!filtered.length) return []

  const relevanceBasis = queries.join(' ') || filtered[0].title || ''
  const relevant = applyRelevanceFilter(relevanceBasis, filtered, roleTokens)
  const limited = relevant.slice(0, 10)
  debugLog('pipeline-summary', { gathered: gathered.length, filtered: filtered.length, relevant: relevant.length, limited: limited.length })
  const enriched = await enrichResults(limited)
  const now = Date.now()
  const fresh = enriched.filter(job => !isLikelyStale(job, now))
  const finalSet = fresh.length ? fresh : enriched
  
  // Sort by recency: newest first
  finalSet.sort((a, b) => {
    const tsA = parsePostedTimestamp(a.postedAt || a.snippet || a.title, now)
    const tsB = parsePostedTimestamp(b.postedAt || b.snippet || b.title, now)
    if (tsA !== null && tsB !== null) return tsB - tsA // Newer first
    if (tsA !== null) return -1 // A has date, B doesn't
    if (tsB !== null) return 1 // B has date, A doesn't
    return 0 // Neither has date
  })
  
  debugLog('enriched-summary', { enriched: enriched.length, fresh: fresh.length, withSalary: finalSet.filter(r => r.salary).length })
  return finalSet
}

function hasArabic(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s)
}

function isListingPage(title: string, url: string): boolean {
  // Check if title indicates a listing/category page
  const listingPatterns = [
    /^\d+\+?\s+(jobs?|positions?)/i,  // "100+ jobs", "22 jobs"
    /^\w+\s+jobs?\s+in\s+kuwait/i,    // "Marketing Jobs in Kuwait" (starts with it)
    /^(entry level|fresh graduate|remote|part time|full time|international|span)\s+\w+\s+jobs?/i,  // "Entry Level Marketing Jobs"
    /jobs?.*\(\w{3}\s+\d{4}\)/i,      // "Marketing Jobs (Oct 2025)"
    /^apply now to/i,                   // "Apply now to over..."
    /^today'?s top/i,                   // "Today's top 100 jobs"
  ]
  
  return listingPatterns.some(p => p.test(title))
}

function allowedJobUrl(u: string, allowListings?: boolean): boolean {
  try {
    const { hostname, pathname } = new URL(u)
    const host = hostname.replace(/^www\./, '')
    const pathLower = pathname.toLowerCase()

    if (host.endsWith('whatjobs.com')) return false

    const isBayt = host === 'bayt.com' || host.endsWith('.bayt.com')
    const isLinkedIn = host === 'linkedin.com' || host === 'kw.linkedin.com'
    const isIndeed = host === 'indeed.com' || host === 'kw.indeed.com' || host === 'indeed.com.kw'

    if (!isBayt && !isLinkedIn && !isIndeed) return false

    if (isBayt) {
      if (allowListings) return true
      return pathname.includes('/job/') || /\/jobs\/[A-Za-z0-9-]+-jobs\//.test(pathLower)
    }

    if (isLinkedIn) {
      if (pathname.includes('/jobs/view/') || pathname.includes('/jobs/collections/')) return true
      if (allowListings) {
        const linkedInListing = pathname.startsWith('/jobs/search')
          || pathname.startsWith('/jobs/jobs-in-')
          || /^\/jobs\/[a-z0-9-]+-jobs/.test(pathLower)
        if (linkedInListing) return true
      }
      return false
    }

    if (isIndeed) {
      if (pathname.includes('/viewjob') || pathname.includes('/pagead/') || pathname.includes('/rc/clk')) return true
      if (allowListings) {
        const indeedListing = pathLower.startsWith('/jobs')
          || pathLower.startsWith('/m/jobs')
          || pathLower.includes('/jobs/')
          || pathLower.endsWith('-jobs')
          || pathLower.endsWith('-jobs.html')
          || (pathLower.startsWith('/q-') && pathLower.includes('-jobs'))
        if (indeedListing) return true
      }
      return false
    }

    return false
  } catch {
    return false
  }
}

function filterAndDedupe(results: JobResult[], opts?: { allowListings?: boolean }): JobResult[] {
  const allowListings = Boolean(opts?.allowListings)
  const seen = new Set<string>()
  const out: JobResult[] = []
  for (const r of results) {
    if (!allowedJobUrl(r.url, allowListings)) {
      debugLog('filtered-disallowed', { url: r.url, title: r.title })
      continue
    }
    if (isClosedPosting(r)) {
      debugLog('filtered-closed', { url: r.url, title: r.title })
      continue
    }
    if (!allowListings && isListingPage(r.title, r.url)) {
      debugLog('filtered-listing', { url: r.url, title: r.title })
      continue
    }
    const key = r.url.split('?')[0]
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimNoise(r))
  }
  const now = Date.now()
  out.sort((a, b) => computeScore(a, now) - computeScore(b, now))
  debugLog('dedupe-summary', { allowListings, kept: out.length })
  return out
}

function extractCompanyAndLocation(title: string, snippet: string, url: string): { company?: string; location?: string } {
  let company: string | undefined
  let location: string | undefined
  
  // Extract company from title patterns like "Job Title - Company Name" or "Job Title at Company"
  const titleMatch = title.match(/[-–—]\s*([^-–—|(]+?)(?:\s*[-–—|]|\s*\(|$)/)
  if (titleMatch) {
    const candidate = titleMatch[1].trim()
    // Filter out noise words and dates
    if (candidate.length > 2 && candidate.length < 60 && 
        !/^(bayt|linkedin|jobs?|careers?|kuwait|الكويت|\d{4}|oct|sep|nov|dec|jan|feb|mar|apr|may|jun|jul|aug|summary|apply|hiring)/i.test(candidate)) {
      company = candidate
    }
  }
  
  // Try "at Company" pattern
  if (!company) {
    const atMatch = title.match(/\bat\s+([A-Z][\w\s&.,'-]+?)(?:\s*[-–—|]|\s*\(|$)/)
    if (atMatch) {
      const candidate = atMatch[1].trim()
      if (candidate.length > 2 && candidate.length < 60) company = candidate
    }
  }
  
  // Extract from snippet if still no company
  if (!company && snippet) {
    const snippetMatch = snippet.match(/(?:at|for|with|join)\s+([A-Z][A-Za-z\s&.,'-]{2,50})(?:\s+in|\s+is|\s+seeks|\.|,|$)/i)
    if (snippetMatch) {
      const candidate = snippetMatch[1].trim()
      if (!/^(kuwait|الكويت|bayt|linkedin)/i.test(candidate)) company = candidate
    }
  }
  
  // Extract location (Kuwait, Kuwait City, Hawali, etc.)
  const locMatch = (title + ' ' + snippet).match(/\b(Kuwait City|Hawali|Salmiya|Farwaniya|Kuwait|الكويت|مدينة الكويت|حولي|السالمية)\b/i)
  if (locMatch) location = locMatch[1]
  
  return { company, location }
}

type SearchOpts = { allowListings?: boolean }

async function searchCSE(q: string, lang: 'en'|'ar', opts?: SearchOpts): Promise<JobResult[]> {
  const key = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX
  if (!key || !cx) return []
  const params = new URLSearchParams()
  params.set('key', key)
  params.set('cx', cx)
  params.set('q', q)
  params.set('gl', 'kw')
  params.set('cr', 'countryKW')
  params.set('lr', lang === 'ar' ? 'lang_ar' : 'lang_en')
  params.set('safe', 'active')
  params.set('num', '10')
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`
  
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) {
      console.error(`[job-search] CSE error: ${r.status}`)
      return []
    }
  const j: any = await r.json().catch(() => ({}))
  const items: any[] = Array.isArray(j.items) ? j.items : []
  const mapped = items.map((it) => {
    const title = String(it.title || it.htmlTitle || '')
    const snippet = String(it.snippet || it.htmlSnippet || '')
    const url = String(it.link || it.formattedUrl || '')
    const { company, location } = extractCompanyAndLocation(title, snippet, url)
    return {
      title,
      url,
      source: (() => {
        try { return new URL(url).hostname.replace(/^www\./,'') } catch { return 'google' }
      })(),
      snippet,
      company,
      location,
    }
  }).filter(x => x.url)
    return filterAndDedupe(mapped, opts)
  } catch (err) {
    console.error('[job-search] CSE fetch failed:', err)
    return []
  }
}

async function searchTavily(q: string, domains?: string[], opts?: SearchOpts): Promise<JobResult[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  try {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: q,
        ...(domains && domains.length ? { include_domains: domains } : {}),
        search_depth: 'basic',
        max_results: 10,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(10000)
    })
    if (!r.ok) {
      console.error(`[job-search] Tavily error: ${r.status}`)
      return []
    }
  const j: any = await r.json().catch(() => ({}))
  const results: any[] = Array.isArray(j.results) ? j.results : []
  const mapped = results.map((it) => {
    const title = String(it.title || '')
    const snippet = String(it.content || it.snippet || '')
    const url = String(it.url || '')
    const { company, location } = extractCompanyAndLocation(title, snippet, url)
    return {
      title,
      url,
      source: (() => { try { return new URL(url).hostname.replace(/^www\./,'') } catch { return 'web' } })(),
      snippet,
      company,
      location,
    }
  }).filter(x => x.url)
    return filterAndDedupe(mapped, opts)
  } catch (err) {
    console.error('[job-search] Tavily fetch failed:', err)
    return []
  }
}

async function summarize(lang: 'en'|'ar', query: string, results: JobResult[]): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  const model = process.env.JOB_BOT_MODEL || 'gpt-4o-mini'
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI({ apiKey })
  const sources = results.slice(0,6).map((r, i) => `${i+1}. ${r.title} — ${r.source}`).join('\n')
  const sys = lang === 'ar'
    ? 'أنت مساعد للوظائف في الكويت. لخّص النتائج بإيجاز وبنقاط واضحة دون وضع روابط إطلاقًا. اعتمد فقط على المصادر المرقّمة المقدمة، ولا تُضِف مواقع أو مصادر جديدة. لا نصائح سيرة ذاتية، ولا تُنشئ وظائف غير موجودة.'
    : 'You are a Kuwait job search assistant. Write a concise summary with bullet points but DO NOT include any URLs. Base your answer ONLY on the numbered sources provided; do not add any new sites. No CV advice. Do not invent jobs.'
  const u = [
    (lang === 'ar' ? 'استعلام:' : 'Query:') + ' ' + query,
    (lang === 'ar' ? 'مصادر (مرقّمة فقط دون روابط):' : 'Sources (numbered, no links):') + '\n' + sources,
    (lang === 'ar' ? 'رجاءً لا تضع أي روابط في النص، واذكر العناصر كأرقام [1] [2] ...' : 'Do not include any URLs; reference items as [1], [2], ...'),
  ].join('\n\n')
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: u },
    ],
  })
  return completion.choices?.[0]?.message?.content || null
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimitWithConfig(req, { maxRequests: 30, windowMs: 10 * 60 * 1000, namespace: 'job-search-assist' })
  if (!rl.success) return createRateLimitResponse(rl)
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = InputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  const qRaw = parsed.data.q.trim()
  const lang: 'en'|'ar' = parsed.data.lang || (hasArabic(qRaw) ? 'ar' : 'en')
  const sessionId = parsed.data.sessionId

  const sessionResults = getSessionResults(sessionId)
  const sessionAnswer = sessionResults ? respondFromSession(sessionResults, qRaw, lang) : null
  if (sessionAnswer) {
    return NextResponse.json({ ok: true, lang, fromCache: true, results: sessionAnswer.results, answer: sessionAnswer.answer })
  }

  try {
    const queries = await extractSearchQueries(qRaw, lang)
    console.log('[job-search] Query:', qRaw, '| Lang:', lang, '| Queries:', queries.length)
    
    let results = await searchWithQueries(queries, qRaw, lang)
    console.log('[job-search] Results:', results.length, '| Query:', qRaw.substring(0, 50))
    
    if (sessionId) saveSessionResults(sessionId, results)

    let answer = await summarize(lang, qRaw, results).catch(() => null)
    
    // Provide helpful message when no results found
    if (!results.length && !answer) {
      answer = lang === 'ar'
        ? 'لم أجد وظائف حديثة مطابقة في الكويت. جرّب:\n• تحديد مسمى وظيفي آخر (مهندس برمجيات، دعم فني، محلل بيانات)\n• إضافة كلمات مثل: حديث التخرج، دوام جزئي، عن بُعد\n• البحث مرة أخرى لاحقاً للوظائف الجديدة'
        : 'No recent jobs found matching your search in Kuwait. Try:\n• A different job title (software engineer, IT support, data analyst)\n• Adding keywords like: junior, entry level, remote, part-time\n• Searching again later for new postings'
    }

    return NextResponse.json({ ok: true, lang, results, answer })
  } catch (error) {
    console.error('[job-search] POST error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: 'Search failed. Please try again.' 
    }, { status: 500 })
  }
}
