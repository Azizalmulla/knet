import { z } from 'zod'

export const WatheeftiDegreeBuckets = [
  'Bachelor’s',
  'Master’s',
  'Computer Science',
  'Computer Engineering',
  'Marketing/PR/Graphic Design',
  'Finance and Accounting',
  'Others',
] as const

export const WatheeftiYoEBuckets = [
  '0–1',
  '2–3',
  '4–5',
  '6+',
] as const

export const WatheeftiAreas = [
  'Operations',
  'Customer Care',
  'Business Development',
  'Marketing',
  'Innovation & Digital Transformation',
  'Finance',
  'Supply Chain',
  'Human Resources',
  'Project Management',
  'Strategy',
  'Audit',
  'Risk Management',
  'Information Security',
  'Fraud Management',
  'IT',
  'Security Operations',
  'Others',
] as const

export const WatheeftiDegreeBucketSchema = z.enum(WatheeftiDegreeBuckets)
export const WatheeftiYoEBucketSchema = z.enum(WatheeftiYoEBuckets)
export const WatheeftiAreaSchema = z.enum(WatheeftiAreas)

export type WatheeftiDegreeBucket = typeof WatheeftiDegreeBuckets[number]
export type WatheeftiYoEBucket = typeof WatheeftiYoEBuckets[number]
export type WatheeftiArea = typeof WatheeftiAreas[number]

export interface KnetProfile {
  degreeBucket: WatheeftiDegreeBucket
  yearsOfExperienceBucket: WatheeftiYoEBucket
  areaOfInterest: WatheeftiArea
}

// Normalization helpers
export function normalizeDegree(input?: string | null): WatheeftiDegreeBucket {
  const s = (input || '').toLowerCase()
  if (/master|msc|m\.sc|m eng|m\.eng|ma\b/.test(s)) return 'Master’s'
  if (/computer\s*science|cs\b/.test(s)) return 'Computer Science'
  if (/computer\s*engineering|comp\s*eng|ce\b/.test(s)) return 'Computer Engineering'
  if (/(marketing|public\s*relations|pr\b|graphic\s*design|design)/.test(s)) return 'Marketing/PR/Graphic Design'
  if (/(finance|accounting|cpa|cfa)/.test(s)) return 'Finance and Accounting'
  if (/bachelor|bsc|b\.sc|bs\b|b eng|b\.eng/.test(s)) return 'Bachelor’s'
  return 'Others'
}

export function normalizeYoE(input?: string | number | null): WatheeftiYoEBucket {
  if (input === null || input === undefined) return '0–1'
  if (typeof input === 'number' && isFinite(input)) {
    const n = Math.max(0, input)
    if (n <= 1) return '0–1'
    if (n <= 3) return '2–3'
    if (n <= 5) return '4–5'
    return '6+'
  }
  const s = String(input).toLowerCase()
  if (/(no\s*experience|internship|<\s*1|less\s*than\s*1|0-1|0–1|0—1)/.test(s)) return '0–1'
  if (/(1-2|1–2|1—2|2-3|2–3|2—3)/.test(s)) return '2–3'
  if (/(4-5|4–5|4—5)/.test(s)) return '4–5'
  if (/(6\+|6\s*\+|6\s*and\s*above|6\s*or\s*more)/.test(s)) return '6+'
  const n = parseFloat(s)
  if (isFinite(n)) return normalizeYoE(n)
  return '0–1'
}

export function normalizeArea(input?: string | null): WatheeftiArea {
  const s = (input || '').toLowerCase()
  const direct = (WatheeftiAreas as readonly string[]).find(a => a.toLowerCase() === s)
  if (direct) return direct as WatheeftiArea
  // Synonyms mapping
  if (/(customer\s*support|call\s*center|contact\s*center)/.test(s)) return 'Customer Care'
  if (/(biz\s*dev|partnerships|sales)/.test(s)) return 'Business Development'
  if (/(innovation|digital\s*transformation|dx)/.test(s)) return 'Innovation & Digital Transformation'
  if (/(hr|human\s*resources)/.test(s)) return 'Human Resources'
  if (/(pm|pmo|project\s*mgmt)/.test(s)) return 'Project Management'
  if (/(it|information\s*technology|software|engineering)/.test(s)) return 'IT'
  if (/(infosec|information\s*security|cyber|security)/.test(s)) return 'Information Security'
  if (/(soc|secops|security\s*operations)/.test(s)) return 'Security Operations'
  if (/(finance|accounting)/.test(s)) return 'Finance'
  if (/(supply\s*chain|logistics)/.test(s)) return 'Supply Chain'
  if (/(audit)/.test(s)) return 'Audit'
  if (/(risk)/.test(s)) return 'Risk Management'
  if (/(fraud)/.test(s)) return 'Fraud Management'
  if (/(marketing|growth)/.test(s)) return 'Marketing'
  if (/(strategy|strategic)/.test(s)) return 'Strategy'
  if (/(operations|ops)/.test(s)) return 'Operations'
  return 'Others'
}

export const KnetProfileSchema = z.object({
  degreeBucket: WatheeftiDegreeBucketSchema,
  yearsOfExperienceBucket: WatheeftiYoEBucketSchema,
  areaOfInterest: WatheeftiAreaSchema,
}).strip()
