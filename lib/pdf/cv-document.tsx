import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font, Image, Svg, Circle, Rect, Path } from '@/lib/pdf/react-pdf-shim'

export type CVTemplate = 'professional' | 'brutalist'

type Palette = { accent: string; border: string; subtle: string; bg?: string; onAccent?: string }
const paletteByTemplate: Record<CVTemplate, Palette> = {
  professional: { accent: '#334155', border: '#E5E7EB', subtle: '#6b7280', bg: '#ffffff' },
  brutalist: { accent: '#111111', border: '#000000', subtle: '#111111', bg: '#ffffff', onAccent: '#000000' },
}

function safeArray<T>(v: any): T[] { return Array.isArray(v) ? v : [] }
const isRTLLang = (lang?: string) => ['ar','he','fa','ur'].includes((lang||'').toLowerCase())
const pickFont = (rtl: boolean) => {
  const families = ((Font as any)._knet_families || {}) as Record<string, boolean>
  return rtl ? (families['NotoKufiArabic'] ? 'NotoKufiArabic' : 'Helvetica') : (families['Inter'] ? 'Inter' : 'Helvetica')
}

// (Removed legacy MinimalPDFTemplate)

// Professional: polished two-column layout (left rail meta, right content)
export function ProfessionalPDFTemplate({ cv, language, density }: { cv: any; language?: string; density?: 'comfortable' | 'compact' }) {
  const rtl = isRTLLang(language || cv?.language)
  const dens = density === 'compact' ? 0.92 : 1
  const p = paletteByTemplate.professional
  const s = StyleSheet.create({
    page: { padding: 40 * dens, fontSize: 10.2 * dens, lineHeight: 1.45, fontFamily: pickFont(rtl) },
    header: { marginBottom: 14 * dens },
    nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    name: { fontSize: 26 * dens, fontWeight: 700, letterSpacing: 0.2, color: '#111827' },
    sub: { color: p.subtle },
    contact: { color: p.subtle, marginTop: 4 },
    rule: { height: 1, backgroundColor: p.border, marginTop: 10, marginBottom: 4 },
    grid: { flexDirection: rtl ? 'row-reverse' : 'row', gap: 14 },
    left: { width: '34%', paddingRight: rtl ? 0 : 8, paddingLeft: rtl ? 8 : 0 },
    right: { width: '66%', paddingLeft: rtl ? 0 : 8, paddingRight: rtl ? 8 : 0 },
    section: { marginTop: 12 * dens },
    title: { fontSize: 12, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
    item: { marginTop: 6 * dens },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
    role: { fontWeight: 600, color: '#111827' },
    bullets: { marginTop: 3 * dens, paddingLeft: rtl ? 0 : 10, paddingRight: rtl ? 10 : 0 },
    bullet: { marginBottom: 2.8 * dens, textAlign: rtl ? 'right' : 'left' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
    chip: { borderWidth: 1, borderColor: p.border, borderStyle: 'solid', paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, borderRadius: 8, marginRight: 4, marginBottom: 4, color: '#374151' },
  })

  // Normalize data
  const name = cv.fullName || cv?.personalInfo?.fullName || 'Unnamed Candidate'
  const title = cv.title || cv?.personalInfo?.title || ''
  const email = cv.email || cv?.personalInfo?.email || ''
  const phone = cv.phone || cv?.personalInfo?.phone || ''
  const location = cv.location || cv?.personalInfo?.location || ''
  const photo = cv.photoUrl || cv?.personalInfo?.photoUrl || cv?.avatarUrl || cv?.personalInfo?.avatarUrl
  const links = (cv?.links || cv?.personalInfo?.links || {}) as Record<string, string>
  const summary = cv.summary || cv?.personalInfo?.summary || ''
  const education = safeArray<any>(cv.education)
  const experience = safeArray<any>(cv.experience || (cv.experienceProjects || []).filter((it: any) => !it.type || it.type === 'experience'))
  const projects = safeArray<any>(cv.projects || (cv.experienceProjects || []).filter((it: any) => it.type === 'project'))
  const tech = safeArray<string>(cv?.skills?.technical)
  const langs = safeArray<string>(cv?.skills?.languages)
  const soft = safeArray<string>(cv?.skills?.soft)

  const dateRange = (start?: string, end?: string, current?: boolean) => {
    const s = (start || '').toString().trim()
    const e = (end || '').toString().trim()
    return [s, (e || (current ? 'Present' : ''))].filter(Boolean).join(' — ')
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.nameRow}>
            <Text style={s.name}>{name}</Text>
            {title ? <Text style={s.sub}>{title}</Text> : null}
          </View>
          {(email || phone || location) && (
            <Text style={s.contact}>{[email, phone, location].filter(Boolean).join(' • ')}</Text>
          )}
          <View style={s.rule} />
        </View>

        {/* Grid */}
        <View style={s.grid}>
          {/* Left rail */}
          <View style={s.left}>
            {(Object.keys(links).length > 0) && (
              <View style={s.section}>
                <Text style={s.title}>Links</Text>
                <View style={s.chips}>
                  {Object.entries(links).slice(0, 6).map(([k, v], i) => (
                    <Text key={i} style={s.chip}>{(k || v).toString().replace(/^https?:\/\//,'')}</Text>
                  ))}
                </View>
              </View>
            )}

            {tech.length > 0 && (
              <View style={s.section}>
                <Text style={s.title}>Skills</Text>
                <View style={s.chips}>
                  {tech.map((t, i) => (<Text key={i} style={s.chip}>{t}</Text>))}
                </View>
              </View>
            )}

            {langs.length > 0 && (
              <View style={s.section}>
                <Text style={s.title}>Languages</Text>
                <View style={s.chips}>
                  {langs.map((t, i) => (<Text key={i} style={s.chip}>{t}</Text>))}
                </View>
              </View>
            )}

            {soft.length > 0 && (
              <View style={s.section}>
                <Text style={s.title}>Soft Skills</Text>
                <View style={s.chips}>
                  {soft.map((t, i) => (<Text key={i} style={s.chip}>{t}</Text>))}
                </View>
              </View>
            )}
          </View>

          {/* Right content */}
          <View style={s.right}>
            {summary ? (
              <View style={s.section}>
                <Text style={s.title}>Summary</Text>
                <Text style={s.sub}>{summary}</Text>
              </View>
            ) : null}

            {experience.length > 0 && (
              <View style={s.section}>
                <Text style={s.title}>Experience</Text>
                {experience.map((e: any, i: number) => (
                  <View key={i} style={s.item}>
                    <View style={s.row}>
                      <Text style={s.role}>{[e.position || e.title, e.company].filter(Boolean).join(' • ')}</Text>
                      <Text style={s.sub}>{dateRange(e.startDate, e.endDate, e.current)}</Text>
                    </View>
                    {e.location ? <Text style={s.sub}>{e.location}</Text> : null}
                    {safeArray<string>(e.bullets).slice(0, 5).length > 0 && (
                      <View style={s.bullets}>
                        {safeArray<string>(e.bullets).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {projects.length > 0 && (
              <View style={s.section}>
                <Text style={s.title}>Projects</Text>
                {projects.map((p: any, i: number) => (
                  <View key={i} style={s.item}>
                    <View style={s.row}>
                      <Text style={s.role}>{p.name}</Text>
                      <Text style={s.sub}>{dateRange(p.startDate, p.endDate, p.current)}</Text>
                    </View>
                    {p.description ? <Text style={s.sub}>{p.description}</Text> : null}
                    {safeArray<string>(p.bullets).slice(0, 5).length > 0 && (
                      <View style={s.bullets}>
                        {safeArray<string>(p.bullets).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                      </View>
                    )}
                    {safeArray<string>(p.technologies).length > 0 && (
                      <View style={s.chips}>
                        {safeArray<string>(p.technologies).map((t, ti) => (<Text key={ti} style={s.chip}>{t}</Text>))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {education.length > 0 && (
              <View style={s.section}>
                <Text style={s.title}>Education</Text>
                {education.map((e: any, i: number) => (
                  <View key={i} style={s.item}>
                    <View style={s.row}>
                      <Text style={s.role}>{[e.degree, e.institution].filter(Boolean).join(' • ')}</Text>
                      <Text style={s.sub}>{dateRange(e.startDate || e.graduationDate, e.endDate, e.currentlyStudying)}</Text>
                    </View>
                    {e.location ? <Text style={s.sub}>{e.location}</Text> : null}
                    {safeArray<string>(e.details).slice(0, 4).length > 0 && (
                      <View style={s.bullets}>
                        {safeArray<string>(e.details).slice(0, 4).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}

// Neo‑Brutalist: thick borders, bold headings, tag chips with outlines
export function BrutalistPDFTemplate({ cv, language, density }: { cv: any; language?: string; density?: 'comfortable' | 'compact' }) {
  const rtl = isRTLLang(language || cv?.language)
  const dens = density === 'compact' ? 0.94 : 1
  const p = paletteByTemplate.brutalist
  const s = StyleSheet.create({
    page: { padding: 24 * dens, fontSize: 10.5 * dens, lineHeight: 1.45, fontFamily: pickFont(rtl), backgroundColor: '#F6F7F2' },
    pageFrame: { backgroundColor: '#A9B8FF', borderWidth: 4, borderColor: '#000', borderRadius: 14, padding: 14 * dens },
    content: { position: 'relative' },
    // Decorative shapes
    shape: { position: 'absolute', top: 0, left: 0 },
    // Header card with photo
    headerCard: { backgroundColor: '#fff', borderWidth: 4, borderColor: '#000', borderRadius: 16, padding: 12 * dens, flexDirection: rtl ? 'row-reverse' : 'row' },
    photoWrap: { width: 110, height: 110, borderRadius: 14, overflow: 'hidden', borderWidth: 4, borderColor: '#000' },
    headerTextCol: { flex: 1, paddingLeft: rtl ? 0 : 12, paddingRight: rtl ? 12 : 0, justifyContent: 'center' },
    name: { fontSize: 28 * dens, fontWeight: 900, color: '#000' },
    titlePill: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#FBE36A', borderWidth: 4, borderColor: '#000', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, fontSize: 11, fontWeight: 700 },
    summary: { marginTop: 8, color: '#111' },
    // Cards
    card: { backgroundColor: '#fff', borderWidth: 4, borderColor: '#000', borderRadius: 16, padding: 10 * dens },
    pillWrap: { alignItems: rtl ? 'flex-end' : 'flex-start', marginBottom: 6 },
    pillPurple: { backgroundColor: '#E9CCFF', borderWidth: 4, borderColor: '#000', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, fontSize: 11, fontWeight: 800, color: '#000' },
    pillYellow: { backgroundColor: '#FBE36A', borderWidth: 4, borderColor: '#000', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, fontSize: 11, fontWeight: 800, color: '#000' },
    pillGreen: { backgroundColor: '#C9F8A3', borderWidth: 4, borderColor: '#000', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, fontSize: 11, fontWeight: 800, color: '#000' },
    // Grid
    gridRow: { flexDirection: rtl ? 'row-reverse' : 'row', gap: 10, marginTop: 10 },
    leftCol: { width: '38%', gap: 10 },
    rightCol: { width: '62%', gap: 10 },
    // Items
    item: { marginTop: 6, padding: 8, borderWidth: 3, borderColor: '#000', borderRadius: 12 },
    row: { flexDirection: rtl ? 'row-reverse' : 'row', justifyContent: 'space-between' },
    role: { fontSize: 12, fontWeight: 800, color: '#000' },
    meta: { fontSize: 10, color: '#111' },
    bullets: { marginTop: 6, paddingLeft: rtl ? 0 : 10, paddingRight: rtl ? 10 : 0 },
    bullet: { marginBottom: 3.2, color: '#000' },
    chipsRow: { flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', marginTop: 6 },
    chip: { borderWidth: 3, borderColor: '#000', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 9999, fontSize: 9.5, color: '#000', marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0, marginBottom: 6 },
    contactRow: { flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap' },
    contactTag: { borderWidth: 3, borderColor: '#000', paddingVertical: 3, paddingHorizontal: 6, borderRadius: 8, fontSize: 9.5, color: '#000', marginRight: rtl ? 0 : 6, marginLeft: rtl ? 6 : 0, marginBottom: 6 },
  })

  const name = cv.fullName || cv?.personalInfo?.fullName || 'Unnamed Candidate'
  const title = cv.title || cv?.personalInfo?.title || ''
  const email = cv.email || cv?.personalInfo?.email || ''
  const phone = cv.phone || cv?.personalInfo?.phone || ''
  const location = cv.location || cv?.personalInfo?.location || ''
  const photo = cv.photoUrl || cv?.personalInfo?.photoUrl || cv?.avatarUrl || cv?.personalInfo?.avatarUrl
  const links = (cv?.links || cv?.personalInfo?.links || {}) as Record<string, string>
  const summary = cv.summary || cv?.personalInfo?.summary || ''
  const education = safeArray<any>(cv.education)
  const experience = safeArray<any>(cv.experience || (cv.experienceProjects || []).filter((it: any) => !it.type || it.type === 'experience'))
  const projects = safeArray<any>(cv.projects || (cv.experienceProjects || []).filter((it: any) => it.type === 'project'))
  const tech = safeArray<string>(cv?.skills?.technical)
  const langs = safeArray<string>(cv?.skills?.languages)
  const soft = safeArray<string>(cv?.skills?.soft)

  const dateRange = (start?: string, end?: string, current?: boolean) => {
    const s = (start || '').toString().trim()
    const e = (end || '').toString().trim()
    return [s, (e || (current ? 'Present' : ''))].filter(Boolean).join(' — ')
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.pageFrame}>
          <View style={s.content}>
            {/* Decorative shapes */}
            <Svg style={[s.shape, { top: -6, left: -6 }]} width={40} height={40}>
              <Rect x={2} y={2} width={36} height={36} fill="#FBE36A" stroke="#000" strokeWidth={4} rx={8} />
            </Svg>
            <Svg style={[s.shape, { top: 6, right: 6, left: 'auto' }]} width={26} height={26}>
              <Circle cx={13} cy={13} r={11} fill="#C9F8A3" stroke="#000" strokeWidth={4} />
            </Svg>

            {/* Header card */}
            <View style={s.headerCard}>
              {photo ? (
                <View style={s.photoWrap}>
                  <Image src={photo} style={{ width: '100%', height: '100%' }} />
                </View>
              ) : (
                <View style={[s.photoWrap, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEE' }]}>
                  <Text style={{ fontSize: 10 }}>No Photo</Text>
                </View>
              )}
              <View style={s.headerTextCol}>
                <Text style={s.name}>{name}</Text>
                {title ? <Text style={s.titlePill}>{title}</Text> : null}
                {summary ? <Text style={s.summary}>{summary}</Text> : null}
              </View>
            </View>

            {/* Grid */}
            <View style={s.gridRow}>
              {/* Left column */}
              <View style={s.leftCol}>
                {/* Education */}
                {education.length > 0 ? (
                  <View style={s.card}>
                    <View style={s.pillWrap}><Text style={s.pillYellow}>Education</Text></View>
                    {education.map((e: any, i: number) => (
                      <View key={i} style={s.item}>
                        <View style={s.row}>
                          <Text style={s.role}>{[e.degree, e.institution].filter(Boolean).join(' • ')}</Text>
                          <Text style={s.meta}>{dateRange(e.startDate || e.graduationDate, e.endDate, e.currentlyStudying)}</Text>
                        </View>
                        {e.location ? <Text style={s.meta}>{e.location}</Text> : null}
                        {safeArray<string>(e.details).slice(0, 4).length > 0 && (
                          <View style={s.bullets}>
                            {safeArray<string>(e.details).slice(0, 4).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Skills */}
                {(tech.length > 0 || soft.length > 0) ? (
                  <View style={s.card}>
                    <View style={s.pillWrap}><Text style={s.pillPurple}>Skills</Text></View>
                    <View style={s.chipsRow}>
                      {tech.map((t, i) => (<Text key={`t-${i}`} style={s.chip}>{t}</Text>))}
                      {soft.map((t, i) => (<Text key={`s-${i}`} style={s.chip}>{t}</Text>))}
                    </View>
                  </View>
                ) : null}

                {/* Languages */}
                {langs.length > 0 ? (
                  <View style={s.card}>
                    <View style={s.pillWrap}><Text style={s.pillGreen}>Languages</Text></View>
                    <View style={s.chipsRow}>
                      {langs.map((t, i) => (<Text key={`l-${i}`} style={s.chip}>{t}</Text>))}
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Right column */}
              <View style={s.rightCol}>
                {/* Experience */}
                {experience.length > 0 ? (
                  <View style={s.card}>
                    <View style={s.pillWrap}><Text style={s.pillPurple}>Experience</Text></View>
                    {experience.map((e: any, i: number) => (
                      <View key={i} style={s.item}>
                        <View style={s.row}>
                          <Text style={s.role}>{[e.position || e.title, e.company].filter(Boolean).join(' • ')}</Text>
                          <Text style={s.meta}>{dateRange(e.startDate, e.endDate, e.current)}</Text>
                        </View>
                        {e.location ? <Text style={s.meta}>{e.location}</Text> : null}
                        {safeArray<string>(e.bullets).slice(0, 5).length > 0 && (
                          <View style={s.bullets}>
                            {safeArray<string>(e.bullets).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* Projects */}
                {projects.length > 0 ? (
                  <View style={s.card}>
                    <View style={s.pillWrap}><Text style={s.pillYellow}>Projects</Text></View>
                    {projects.map((p: any, i: number) => (
                      <View key={i} style={s.item}>
                        <View style={s.row}>
                          <Text style={s.role}>{p.name}</Text>
                          <Text style={s.meta}>{dateRange(p.startDate, p.endDate, p.current)}</Text>
                        </View>
                        {p.description ? <Text style={s.meta}>{p.description}</Text> : null}
                        {safeArray<string>(p.technologies).length > 0 ? (
                          <View style={s.chipsRow}>
                            {safeArray<string>(p.technologies).map((t, ti) => (<Text key={ti} style={s.chip}>{t}</Text>))}
                          </View>
                        ) : null}
                        {safeArray<string>(p.bullets).slice(0, 5).length > 0 && (
                          <View style={s.bullets}>
                            {safeArray<string>(p.bullets).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            {/* Contact card at bottom */}
            {(email || phone || location || Object.keys(links).length > 0) ? (
              <View style={[s.card, { marginTop: 12 }] }>
                <View style={s.pillWrap}><Text style={s.pillYellow}>Contact</Text></View>
                <View style={s.contactRow}>
                  {[email, phone, location].filter(Boolean).map((v, i) => (
                    <Text key={i} style={s.contactTag}>{String(v)}</Text>
                  ))}
                  {Object.entries(links).slice(0, 6).map(([k, v], i) => (
                    <Text key={`c-${i}`} style={s.contactTag}>{(k || v).toString().replace(/^https?:\/\//,'')}</Text>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  )
}

export function createCVDocument(cv: any = {}, _template?: any, language?: string, _density: 'comfortable' | 'compact' = 'comfortable') {
  return <ProfessionalPDFTemplate cv={cv} language={language} density={'comfortable'} />
}

export function createBrutalistDocument(cv: any = {}, language?: string, density: 'comfortable' | 'compact' = 'comfortable') {
  return <BrutalistPDFTemplate cv={cv} language={language} density={density} />
}
