// Map our internal CV JSON to JSON Resume schema
// https://jsonresume.org/schema/

export type JsonResume = {
  basics?: any;
  work?: any[];
  education?: any[];
  projects?: any[];
  skills?: any[];
  languages?: any[];
  certificates?: any[];
  awards?: any[];
};

function toArray<T>(v: any): T[] {
  return Array.isArray(v) ? v : []
}

export function mapToJsonResume(cv: any = {}): JsonResume {
  const basics: any = {}
  const fullName = cv.fullName || cv?.personalInfo?.fullName || ''
  const email = cv.email || cv?.personalInfo?.email || ''
  const phone = cv.phone || cv?.personalInfo?.phone || ''
  const location = cv.location || cv?.personalInfo?.location || ''
  const summary = cv.summary || cv?.personalInfo?.summary || ''
  const headline = cv.headline || cv?.personalInfo?.headline || ''
  const links = (cv?.links || cv?.personalInfo?.links || {}) as Record<string, string>

  basics.name = fullName
  if (headline) basics.label = headline  // "Software Engineer", "Fresh Graduate"
  if (email) basics.email = email
  if (phone) basics.phone = phone
  if (summary) basics.summary = summary
  if (location) basics.location = { address: location }
  // Prefer portfolio as primary website; fallback to LinkedIn then GitHub
  const portfolio = (links['portfolio'] || links['website'] || '').trim()
  const linkedin = (links['linkedin'] || '').trim()
  const github = (links['github'] || '').trim()
  if (portfolio) basics.website = portfolio
  else if (linkedin) basics.website = linkedin
  else if (github) basics.website = github

  basics.profiles = [
    linkedin ? { network: 'LinkedIn', username: '', url: linkedin } : null,
    github ? { network: 'GitHub', username: '', url: github } : null,
    portfolio ? { network: 'Portfolio', username: '', url: portfolio } : null,
    // include any other arbitrary links the user added
    ...Object.entries(links || {})
      .filter(([k]) => k !== 'linkedin' && k !== 'github' && k !== 'portfolio' && k !== 'website')
      .slice(0, 7)
      .map(([k, v]) => ({ network: k || '', username: '', url: v }))
  ].filter(Boolean)

  // Normalize dates to ISO YYYY-MM so theme's Moment parser is happy
  const monthMap: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  }
  const normalizeDate = (val: any): string => {
    const raw = (val ?? '').toString().trim()
    if (!raw) return ''
    // ISO already
    if (/^\d{4}$/.test(raw)) return `${raw}-01`
    if (/^\d{4}-\d{2}$/.test(raw)) return raw
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 10)
    // MM/YYYY or M/YYYY
    let m = raw.match(/^(\d{1,2})[\/\-\.\s](\d{4})$/)
    if (m) {
      const mm = Math.min(12, Math.max(1, parseInt(m[1], 10)))
      return `${m[2]}-${String(mm).padStart(2, '0')}`
    }
    // YYYY/MM or YYYY/M
    m = raw.match(/^(\d{4})[\/\-\.\s](\d{1,2})$/)
    if (m) {
      const mm = Math.min(12, Math.max(1, parseInt(m[2], 10)))
      return `${m[1]}-${String(mm).padStart(2, '0')}`
    }
    // MonthName YYYY (e.g., Jan 2023, january 2023)
    const tokens = raw.toLowerCase().replace(/\./g, '').split(/\s+/)
    if (tokens.length === 2 && /^\d{4}$/.test(tokens[1]) && monthMap[tokens[0]]) {
      return `${tokens[1]}-${monthMap[tokens[0]]}`
    }
    // YYYY MonthName
    if (tokens.length === 2 && /^\d{4}$/.test(tokens[0]) && monthMap[tokens[1]]) {
      return `${tokens[0]}-${monthMap[tokens[1]]}`
    }
    // Fallback: try to extract year and month numbers anywhere
    const y = raw.match(/(19|20)\d{2}/)?.[0]
    const mon = raw.match(/\b(1[0-2]|0?[1-9])\b/)?.[0]
    if (y && mon) return `${y}-${String(parseInt(mon, 10)).padStart(2, '0')}`
    return ''
  }

  // Work (prefer new experienceProjects with type == 'experience')
  const expProjects = toArray<any>(cv.experienceProjects)
  const expA = expProjects.filter((it) => !it?.type || it?.type === 'experience')
  const expB = toArray<any>(cv.experience)
  const workSrc = (expA.length ? expA : expB)
  const work = workSrc.map((e: any) => ({
    name: e?.company || '',
    position: e?.position || e?.title || '',
    startDate: normalizeDate(e?.startDate),
    endDate: e?.current ? '' : normalizeDate(e?.endDate),
    summary: e?.description || '',
    highlights: Array.isArray(e?.bullets) ? e.bullets.slice(0, 8) : [],
    location: e?.location || undefined,
  }))

  // Education
  const education = toArray<any>(cv.education).map((e: any) => ({
    institution: e?.institution || '',
    area: e?.fieldOfStudy || '',
    studyType: e?.degree || '',
    startDate: normalizeDate(e?.startDate),
    endDate: e?.currentlyStudying ? '' : normalizeDate(e?.endDate || e?.graduationDate),
    score: e?.gpa || undefined,
  }))

  // Projects (prefer new experienceProjects type == 'project' else legacy projects)
  const projA = expProjects.filter((it) => it?.type === 'project')
  const projB = toArray<any>(cv.projects)
  const projSrc = (projA.length ? projA : projB)
  const projects = projSrc.map((p: any) => ({
    name: p?.name || '',
    description: p?.description || '',
    keywords: Array.isArray(p?.technologies) ? p.technologies : [],
    url: p?.url || '',
    highlights: Array.isArray(p?.bullets) ? p.bullets.slice(0, 6) : [],
    startDate: normalizeDate(p?.startDate),
    endDate: p?.current ? '' : normalizeDate(p?.endDate),
  }))

  // Skills - handle both old and new schema
  const technical = toArray<string>(cv?.skills?.technical)
  const frameworks = toArray<string>(cv?.skills?.frameworks || cv?.skills?.frameworksLibraries)
  const tools = toArray<string>(cv?.skills?.tools || cv?.skills?.toolsPlatforms)
  const databases = toArray<string>(cv?.skills?.databases)
  const cloud = toArray<string>(cv?.skills?.cloud)
  const soft = toArray<string>(cv?.skills?.soft || cv?.skills?.softSkills)
  
  const skills = [] as any[]
  if (technical.length) skills.push({ name: 'Programming Languages', keywords: technical })
  if (frameworks.length) skills.push({ name: 'Frameworks & Libraries', keywords: frameworks })
  if (tools.length) skills.push({ name: 'Tools & Platforms', keywords: tools })
  if (databases.length) skills.push({ name: 'Databases', keywords: databases })
  if (cloud.length) skills.push({ name: 'Cloud Services', keywords: cloud })
  if (soft.length) skills.push({ name: 'Soft Skills', keywords: soft })

  // Languages
  const languages = toArray<string>(cv?.skills?.languages).map((lang) => ({ language: lang }))

  // Certifications (map to JSON Resume certificates)
  const certifications = toArray<string>(cv?.certifications).map((name) => ({ name }))

  // Achievements/Awards
  const awards = toArray<string>(cv?.achievements).map((title) => ({ title }))

  const out: JsonResume = { 
    basics, 
    work, 
    education, 
    projects, 
    skills, 
    languages,
    certificates: certifications.length ? certifications : undefined,
    awards: awards.length ? awards : undefined,
  }
  return out
}
