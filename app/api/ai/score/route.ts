import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

// Input accepts either { cv } or { form } in the builder's CV structure
const InputSchema = z.object({
  cv: z.any().optional(),
  form: z.any().optional(),
  targetRole: z.string().optional(),
}).strip()

// Utilities
function safeLower(s?: string | null) {
  return (s || '').toLowerCase()
}

function isNumericGpa(g?: any): number | null {
  if (g === null || g === undefined) return null
  const asNum = typeof g === 'number' ? g : parseFloat(String(g))
  if (!Number.isFinite(asNum)) return null
  if (asNum <= 0 || asNum > 10) {
    // Most scales are 0..4.0; if someone uses 0..100 scale, normalize if > 10
    if (asNum <= 100) {
      // attempt to normalize 0..100 to 0..4 by dividing by 25
      const norm = asNum / 25
      return Math.max(0, Math.min(4, norm))
    }
    return null
  }
  return Math.max(0, Math.min(4, asNum))
}

function pickDisplayGPA(cv: any): string {
  try {
    const edu = Array.isArray(cv?.education) ? cv.education : []
    for (const e of edu) {
      const g = isNumericGpa((e as any)?.gpa)
      if (g !== null) return String(Number(g).toFixed(2))
    }
    return 'N/A'
  } catch {
    return 'N/A'
  }
}

function hasQuantified(text: string): boolean {
  // numbers, percentages, or quantities like 10k, 2M
  return /(\b\d+(?:[.,]\d+)?\b|\b\d+(?:k|m)\b|%)/i.test(text)
}

function hasLeadership(text: string): boolean {
  return /(led|managed|mentored|owned|architected|supervised|coordinated|headed|spearheaded|directed)/i.test(text)
}

function isUrlLike(text?: string): boolean {
  return !!text && /https?:\/\//i.test(text)
}

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

function asArray(val: any): any[] { return Array.isArray(val) ? val : [] }

function collectText(...vals: any[]): string {
  return vals.map(v => typeof v === 'string' ? v : '').filter(Boolean).join(' ')
}

function cleanBullet(s: string): string {
  const trimmed = (s || '').trim()
  if (!trimmed) return trimmed
  // keep as-is without forcing period to avoid fabricating punctuation
  return trimmed
}

// Scoring helpers based on rubric
function scoreWorkExperience(cv: any) {
  const exps = asArray(cv?.experienceProjects).filter((it: any) => it?.type === 'experience')
    .concat(asArray(cv?.experience))

  let countScore = 0
  let bulletsScore = 0
  let quantifyScore = 0
  let leadershipScore = 0
  let techSignal = 0

  // Count factor (up to 10)
  const expCount = Math.min(exps.length, 3) // cap at 3 for diminishing returns
  countScore = (expCount / 3) * 10

  // Analyze bullets, quantification, leadership, and tech mentions
  let totalBullets = 0
  let quantifiedBullets = 0
  let leadershipHits = 0
  let techHits = 0

  for (const e of exps) {
    const desc = collectText(e?.description)
    const bullets = asArray(e?.bullets)
    totalBullets += bullets.length
    bullets.forEach((b: string) => {
      const t = String(b || '')
      if (hasQuantified(t)) quantifiedBullets += 1
      if (hasLeadership(t)) leadershipHits += 1
      if (/(react|node|typescript|python|java|aws|docker|kubernetes|sql|mongodb|postgres|next\.js|azure|gcp)/i.test(t)) techHits += 1
    })
    if (hasLeadership(desc)) leadershipHits += 1
    if (/(react|node|typescript|python|java|aws|docker|kubernetes|sql|mongodb|postgres|next\.js|azure|gcp)/i.test(desc)) techHits += 1
  }

  // Bullets density (up to 10)
  const normBullets = Math.min(totalBullets, 12) / 12
  bulletsScore = normBullets * 10

  // Quantified share (up to 10)
  const qShare = totalBullets > 0 ? (quantifiedBullets / totalBullets) : 0
  quantifyScore = qShare * 10

  // Leadership presence (up to 3)
  leadershipScore = Math.min(leadershipHits, 3) // raw count; scale below
  leadershipScore = (leadershipScore / 3) * 3

  // Tech signal (up to 2)
  techSignal = Math.min(techHits, 4)
  techSignal = (techSignal / 4) * 2

  const total = Math.min(35, countScore + bulletsScore + quantifyScore + leadershipScore + techSignal)
  return { total, details: { expCount, totalBullets, quantifiedBullets, leadershipHits, techHits } }
}

function scoreProjects(cv: any) {
  const projects = asArray(cv?.experienceProjects).filter((it: any) => it?.type === 'project')
    .concat(asArray(cv?.projects))

  let countScore = 0
  let techBreadthScore = 0
  let impactScore = 0
  let deployScore = 0

  const projCount = Math.min(projects.length, 4)
  countScore = (projCount / 4) * 6 // up to 6 points from count

  // Tech breadth across projects
  const allTech: string[] = []
  let totalProjBullets = 0
  let quantifiedProjBullets = 0
  let hasDeploy = false

  for (const p of projects) {
    const techs = asArray(p?.technologies).map((t: any) => String(t || '').toLowerCase())
    allTech.push(...techs)
    const bullets = asArray(p?.bullets)
    totalProjBullets += bullets.length
    bullets.forEach((b: string) => { if (hasQuantified(String(b))) quantifiedProjBullets += 1 })
    if (isUrlLike(p?.url)) hasDeploy = true
  }
  const techBreadth = unique(allTech).length
  techBreadthScore = Math.min(techBreadth, 10) / 10 * 8 // up to 8

  // Impact via quantified bullets
  const qShare = totalProjBullets > 0 ? quantifiedProjBullets / totalProjBullets : 0
  impactScore = qShare * 9 // up to 9

  // Deployed or linked
  deployScore = hasDeploy ? 2 : 0

  const total = Math.min(25, countScore + techBreadthScore + impactScore + deployScore)
  return { total, details: { projCount: projects.length, techBreadth, totalProjBullets, quantifiedProjBullets, hasDeploy } }
}

function scoreSkills(cv: any) {
  const tech = asArray(cv?.skills?.technical)
  const languages = asArray(cv?.skills?.languages)
  const soft = asArray(cv?.skills?.soft)

  // Depth/breadth via number of technical skills
  const techCount = tech.length
  const breadthScore = Math.min(techCount, 12) / 12 * 14 // up to 14

  // Programming languages may indicate depth; add a small boost
  const progLangCount = languages.filter((l: string) => /english|arabic/i.test(l) ? false : true).length // keep only if not natural languages
  const depthScore = Math.min(progLangCount, 4) / 4 * 4 // up to 4

  // Certification marker inside skills (not counted in certs section to avoid double counting heavily)
  const certSignal = tech.some((s: string) => /certified|aws|azure|gcp|scrum|pmp|kubernetes|cka|ckad/i.test(String(s))) ? 2 : 0 // up to 2

  const total = Math.min(20, breadthScore + depthScore + certSignal)
  return { total, details: { techCount, progLangCount, certSignal: certSignal > 0 } }
}

function scoreEducation(cv: any) {
  const edu = asArray(cv?.education)
  if (edu.length === 0) return { total: 0, details: { hasEdu: false, gpa: null, honors: false } }
  const e = edu[0]
  const hasDegree = !!e?.degree
  const hasField = !!e?.fieldOfStudy
  const gpa = isNumericGpa(e?.gpa)
  const honors = /honors|honours|dean|cum laude|magna|summa/i.test(String(e?.description || ''))

  let pts = 0
  pts += hasDegree ? 3 : 0
  pts += hasField ? 2 : 0
  pts += gpa !== null ? (Math.max(0, Math.min(4, gpa)) / 4) * 5 : 0 // GPA up to 5
  pts += honors ? 1 : 0
  const total = Math.min(10, pts)
  return { total, details: { hasEdu: true, gpa, honors } }
}

function scoreCertsAwards(cv: any) {
  // No dedicated fields; inspect summary, education description, skills.technical for known cert markers
  const textBag = [
    String(cv?.summary || ''),
    ...asArray(cv?.education).map((e: any) => String(e?.description || '')),
    ...asArray(cv?.skills?.technical).map((s: any) => String(s || '')),
  ].join(' ')

  const hasCert = /(certified|aws certified|azure certified|google cloud|gcp professional|pmp|scrum master|cka|ckad|ccna|ccnp|oracle certified|red hat)/i.test(textBag)
  const hasAward = /(award|awards|winner|recognition|dean's list|deans list|honors)/i.test(textBag)
  const hasExtra = /(club|hackathon|volunteer|open source|publication)/i.test(textBag)

  let pts = 0
  if (hasCert) pts += 5
  if (hasAward) pts += 3
  if (hasExtra) pts += 2
  const total = Math.min(10, pts)
  return { total, details: { hasCert, hasAward, hasExtra } }
}

function buildReasons(parts: {
  exp: ReturnType<typeof scoreWorkExperience>,
  proj: ReturnType<typeof scoreProjects>,
  skills: ReturnType<typeof scoreSkills>,
  edu: ReturnType<typeof scoreEducation>,
  ca: ReturnType<typeof scoreCertsAwards>,
}) {
  const reasons: string[] = []
  // Experience
  if (parts.exp.details.quantifiedBullets > 0) reasons.push(`+ Quantified impact in ${parts.exp.details.quantifiedBullets} experience bullet(s)`) 
  else reasons.push('- No quantified impact in experience bullets')
  if (parts.exp.details.leadershipHits > 0) reasons.push('+ Leadership indicators present')
  else reasons.push('- No clear leadership indicators')

  // Projects
  if (parts.proj.details.quantifiedProjBullets > 0) reasons.push(`+ Project metrics present in ${parts.proj.details.quantifiedProjBullets} bullet(s)`)
  else reasons.push('- Projects lack measurable outcomes')
  if (parts.proj.details.techBreadth > 0) reasons.push(`+ Uses ${parts.proj.details.techBreadth} distinct technologies across projects`)

  // Skills
  if (parts.skills.details.techCount >= 8) reasons.push('+ Strong breadth of technical skills')
  else if (parts.skills.details.techCount > 0) reasons.push(`+ ${parts.skills.details.techCount} technical skills listed`)
  else reasons.push('- No technical skills listed')

  // Education
  const gpaStr = parts.edu.details.gpa !== null && parts.edu.details.gpa !== undefined ? Number(parts.edu.details.gpa).toFixed(2) : 'N/A'
  if (gpaStr !== 'N/A') reasons.push(`+ GPA ${gpaStr}`)
  else reasons.push('- GPA not provided')

  // Certs/Awards/Extracurriculars
  if (parts.ca.details.hasCert) reasons.push('+ Relevant certification(s)')
  else reasons.push('- No certifications listed')
  if (parts.ca.details.hasAward) reasons.push('+ Awards or honors')

  return reasons
}

function improveCV(cv: any): any {
  try {
    const out = JSON.parse(JSON.stringify(cv || {}))
    // Trim bullets safely
    if (Array.isArray(out?.experienceProjects)) {
      out.experienceProjects = out.experienceProjects.map((item: any) => {
        if (Array.isArray(item?.bullets)) {
          item.bullets = item.bullets.map((b: any) => cleanBullet(String(b || ''))).filter((b: string) => !!b)
        }
        return item
      })
    }
    if (Array.isArray(out?.experience)) {
      out.experience = out.experience.map((item: any) => {
        if (Array.isArray(item?.bullets)) {
          item.bullets = item.bullets.map((b: any) => cleanBullet(String(b || ''))).filter((b: string) => !!b)
        }
        return item
      })
    }
    if (Array.isArray(out?.projects)) {
      out.projects = out.projects.map((p: any) => {
        if (Array.isArray(p?.bullets)) {
          p.bullets = p.bullets.map((b: any) => cleanBullet(String(b || ''))).filter((b: string) => !!b)
        }
        return p
      })
    }
    // Deduplicate skills
    if (out?.skills) {
      if (Array.isArray(out.skills.technical)) out.skills.technical = unique(out.skills.technical.map((s: any) => String(s || '').trim()).filter(Boolean))
      if (Array.isArray(out.skills.languages)) out.skills.languages = unique(out.skills.languages.map((s: any) => String(s || '').trim()).filter(Boolean))
      if (Array.isArray(out.skills.soft)) out.skills.soft = unique(out.skills.soft.map((s: any) => String(s || '').trim()).filter(Boolean))
    }
    return out
  } catch {
    return cv
  }
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json()
    const input = InputSchema.safeParse(raw)
    if (!input.success) {
      return NextResponse.json({ error: 'Invalid request payload', details: input.error.flatten() }, { status: 400 })
    }

    const cv = input.data.cv ?? input.data.form ?? {}

    // Compute per-category scores
    const exp = scoreWorkExperience(cv)
    const proj = scoreProjects(cv)
    const skills = scoreSkills(cv)
    const edu = scoreEducation(cv)
    const ca = scoreCertsAwards(cv)

    // Total candidate score (0..100), clamp
    const candidate_score = Math.max(0, Math.min(100, Math.round(exp.total + proj.total + skills.total + edu.total + ca.total)))

    const score_reasons = buildReasons({ exp, proj, skills, edu, ca })
    const displayGPA = pickDisplayGPA(cv)

    // Improved CV (non-fabricating hygiene only)
    const improved = improveCV(cv)

    return NextResponse.json({
      displayGPA,
      candidate_score,
      score_reasons,
      cv: improved,
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to score CV', detail: String(error?.message || error) }, { status: 500 })
  }
}
