import React from 'react'
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

export type CVTemplate = 'minimal' | 'modern' | 'creative'

type Palette = { accent: string; border: string; subtle: string; bg?: string; onAccent?: string }
// KNET brand: blue #0A5D86, yellow #FFE200, gray #E6EEF5
const paletteByTemplate: Record<CVTemplate, Palette> = {
  minimal: { accent: '#0A5D86', border: '#E6EEF5', subtle: '#6b7280' },
  modern: { accent: '#0A5D86', border: '#E6EEF5', subtle: '#4b5563', bg: '#F7FAFC', onAccent: '#ffffff' },
  creative: { accent: '#0A5D86', border: '#E6EEF5', subtle: '#6b7280', bg: '#0A5D86', onAccent: '#ffffff' },
}

function safeArray<T>(v: any): T[] { return Array.isArray(v) ? v : [] }
const isRTLLang = (lang?: string) => ['ar','he','fa','ur'].includes((lang||'').toLowerCase())
const pickFont = (rtl: boolean) => {
  const families = ((Font as any)._knet_families || {}) as Record<string, boolean>
  return rtl ? (families['NotoKufiArabic'] ? 'NotoKufiArabic' : 'Helvetica') : (families['Inter'] ? 'Inter' : 'Helvetica')
}

// Minimal: centered, clean top header, simple sections
export function MinimalPDFTemplate({ cv, language }: { cv: any; language?: string }) {
  const rtl = isRTLLang(language || cv?.language)
  const s = StyleSheet.create({
    page: { padding: 36, fontSize: 11, lineHeight: 1.4, fontFamily: pickFont(rtl) },
    header: { paddingBottom: 10, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E6EEF5', borderBottomStyle: 'solid' },
    name: { fontSize: 22, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.6 },
    contact: { color: '#6b7280', marginTop: 4, textAlign: 'center' },
    section: { marginTop: 14 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    yellowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFE200' },
    sectionTitle: { fontSize: 12, fontWeight: 700, color: '#0A5D86', textTransform: 'uppercase', letterSpacing: 0.5 },
    rule: { height: 1, backgroundColor: '#E6EEF5', marginTop: 8 },
    item: { marginBottom: 6 },
    itemTitle: { fontSize: 11.5, fontWeight: 600 },
    itemSub: { color: '#6b7280' },
    bullets: { marginTop: 4, paddingLeft: rtl ? 0 : 10, paddingRight: rtl ? 10 : 0 },
    bullet: { marginBottom: 3, textAlign: rtl ? 'right' : 'left' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: { borderWidth: 1, borderColor: '#E6EEF5', borderStyle: 'solid', backgroundColor: '#F7FAFC', paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, borderRadius: 8, marginRight: 4, marginBottom: 4, color: '#374151' },
  })
  const name = cv.fullName || cv?.personalInfo?.fullName || 'Unnamed Candidate'
  const email = cv.email || cv?.personalInfo?.email || ''
  const phone = cv.phone || cv?.personalInfo?.phone || ''
  const summary = cv.summary || cv?.personalInfo?.summary || ''
  const education = safeArray<any>(cv.education)
  const experience = safeArray<any>(cv.experience || (cv.experienceProjects || []).filter((it: any) => !it.type || it.type === 'experience'))
  const projects = safeArray<any>(cv.projects || (cv.experienceProjects || []).filter((it: any) => it.type === 'project'))
  const tech = safeArray<string>(cv?.skills?.technical)
  const langs = safeArray<string>(cv?.skills?.languages)
  const soft = safeArray<string>(cv?.skills?.soft)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{name}</Text>
          {(email || phone) && <Text style={s.contact}>{[email, phone].filter(Boolean).join(' • ')}</Text>}
          {summary ? <Text style={{ color: '#374151' }}>{summary}</Text> : null}
        </View>

        {experience.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.yellowDot} />
              <Text style={s.sectionTitle}>Experience</Text>
            </View>
            {experience.map((e: any, idx: number) => (
              <View key={idx} style={s.item}>
                <Text style={s.itemTitle}>{[e.position || e.title, e.company].filter(Boolean).join(' • ')}</Text>
                <Text style={s.itemSub}>{[e.location, [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' - ')].filter(Boolean).join(' • ')}</Text>
                {safeArray<string>(e.bullets).slice(0, 6).length > 0 && (
                  <View style={s.bullets}>
                    {safeArray<string>(e.bullets).slice(0, 6).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                  </View>
                )}
              </View>
            ))}
            <View style={s.rule} />
          </View>
        )}

        {education.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.yellowDot} />
              <Text style={s.sectionTitle}>Education</Text>
            </View>
            {education.map((e: any, idx: number) => (
              <View key={idx} style={s.item}>
                <Text style={s.itemTitle}>{[e.degree, e.institution].filter(Boolean).join(' • ')}</Text>
                <Text style={s.itemSub}>{[e.location, [e.startDate, e.endDate].filter(Boolean).join(' - ')].filter(Boolean).join(' • ')}</Text>
                {safeArray<string>(e.details).slice(0, 5).length > 0 && (
                  <View style={s.bullets}>
                    {safeArray<string>(e.details).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                  </View>
                )}
              </View>
            ))}
            <View style={s.rule} />
          </View>
        )}

        {projects.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.yellowDot} />
              <Text style={s.sectionTitle}>Projects</Text>
            </View>
            {projects.map((p: any, idx: number) => (
              <View key={idx} style={s.item}>
                <Text style={s.itemTitle}>{p.name}</Text>
                {p.description ? <Text style={s.itemSub}>{p.description}</Text> : null}
                {safeArray<string>(p.bullets).slice(0, 5).length > 0 && (
                  <View style={s.bullets}>
                    {safeArray<string>(p.bullets).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                  </View>
                )}
                {safeArray<string>(p.technologies).length > 0 && (
                  <View style={s.chipsRow}>
                    {safeArray<string>(p.technologies).map((t, ti) => (<Text key={ti} style={s.chip}>{t}</Text>))}
                  </View>
                )}
              </View>
            ))}
            <View style={s.rule} />
          </View>
        )}

        {(tech.length || langs.length || soft.length) > 0 && (
          <View style={s.section}>
            <View style={s.sectionTitleRow}>
              <View style={s.yellowDot} />
              <Text style={s.sectionTitle}>Skills</Text>
            </View>
            {tech.length > 0 && <Text>Technical: {tech.join(', ')}</Text>}
            {langs.length > 0 && <Text>Languages: {langs.join(', ')}</Text>}
            {soft.length > 0 && <Text>Soft: {soft.join(', ')}</Text>}
          </View>
        )}
      </Page>
    </Document>
  )
}

// Modern: top header with accent bar
export function ModernPDFTemplate({ cv, language }: { cv: any; language?: string }) {
  const rtl = isRTLLang(language || cv?.language)
  const p = paletteByTemplate.modern
  const s = StyleSheet.create({
    page: { padding: 0, fontSize: 11, lineHeight: 1.4, fontFamily: pickFont(rtl) },
    header: { backgroundColor: p.accent, color: '#fff', paddingVertical: 14, paddingHorizontal: 24 },
    hName: { fontSize: 22, fontWeight: 700, color: '#fff' },
    hContact: { color: '#fff', marginTop: 3 },
    content: { padding: 24 },
    row: { flexDirection: 'row', gap: 12 },
    left: { width: '65%', paddingRight: 6 },
    right: { width: '35%', paddingLeft: 6, backgroundColor: p.bg || '#F7FAFC', borderRadius: 8, padding: 12 },
    section: { marginTop: 12 },
    title: { fontSize: 12, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    rule: { height: 1, backgroundColor: p.border, marginTop: 8 },
    item: { marginTop: 6 },
    sub: { color: p.subtle },
    bullets: { marginTop: 4, paddingLeft: rtl ? 0 : 10, paddingRight: rtl ? 10 : 0 },
    bullet: { marginBottom: 3, textAlign: rtl ? 'right' : 'left' },
    chip: { backgroundColor: '#fff', color: p.accent, borderWidth: 1, borderColor: p.border, borderStyle: 'solid', paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, borderRadius: 9999, marginRight: 4, marginBottom: 4 },
  })
  const name = cv.fullName || cv?.personalInfo?.fullName || 'Unnamed Candidate'
  const email = cv.email || cv?.personalInfo?.email || ''
  const phone = cv.phone || cv?.personalInfo?.phone || ''
  const summary = cv.summary || cv?.personalInfo?.summary || ''
  const education = safeArray<any>(cv.education)
  const experience = safeArray<any>(cv.experience || (cv.experienceProjects || []).filter((it: any) => !it.type || it.type === 'experience'))
  const projects = safeArray<any>(cv.projects || (cv.experienceProjects || []).filter((it: any) => it.type === 'project'))

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.hName}>{name}</Text>
          {(email || phone) && <Text style={s.hContact}>{[email, phone].filter(Boolean).join(' • ')}</Text>}
          {summary ? <Text style={{ color: '#F3F4F6', marginTop: 4 }}>{summary}</Text> : null}
        </View>

        <View style={s.content}>
          <View style={s.row}>
            <View style={s.left}>
              {experience.length > 0 && (
                <View style={s.section}>
                  <Text style={s.title}>Experience</Text>
                  {experience.map((e: any, i: number) => (
                    <View key={i} style={s.item}>
                      <Text>{[e.position || e.title, e.company].filter(Boolean).join(' • ')}</Text>
                      <Text style={s.sub}>{[e.location, [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' - ')].filter(Boolean).join(' • ')}</Text>
                      {safeArray<string>(e.bullets).slice(0, 6).length > 0 && (
                        <View style={s.bullets}>
                          {safeArray<string>(e.bullets).slice(0, 6).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                        </View>
                      )}
                    </View>
                  ))}
                  <View style={s.rule} />
                </View>
              )}

              {projects.length > 0 && (
                <View style={s.section}>
                  <Text style={s.title}>Projects</Text>
                  {projects.map((p: any, i: number) => (
                    <View key={i} style={s.item}>
                      <Text>{p.name}</Text>
                      {p.description ? <Text style={s.sub}>{p.description}</Text> : null}
                      {safeArray<string>(p.bullets).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={s.right}>
              {(safeArray<string>(cv?.skills?.technical).length > 0) && (
                <View style={s.section}>
                  <Text style={s.title}>Skills</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {safeArray<string>(cv?.skills?.technical).map((t, i) => (
                      <Text key={i} style={s.chip}>{t}</Text>
                    ))}
                  </View>
                </View>
              )}

              {(safeArray<string>(cv?.skills?.languages).length > 0) && (
                <View style={s.section}>
                  <Text style={s.title}>Languages</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {safeArray<string>(cv?.skills?.languages).map((t, i) => (
                      <Text key={i} style={s.chip}>{t}</Text>
                    ))}
                  </View>
                </View>
              )}

              {education.length > 0 && (
                <View style={s.section}>
                  <Text style={s.title}>Education</Text>
                  {education.map((e: any, i: number) => (
                    <View key={i} style={s.item}>
                      <Text>{[e.degree, e.institution].filter(Boolean).join(' • ')}</Text>
                      <Text style={s.sub}>{[e.location, [e.startDate, e.endDate].filter(Boolean).join(' - ')].filter(Boolean).join(' • ')}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// Creative: left sidebar with accent background; right content
export function CreativePDFTemplate({ cv, language }: { cv: any; language?: string }) {
  const rtl = isRTLLang(language || cv?.language)
  const p = paletteByTemplate.creative
  const s = StyleSheet.create({
    page: { padding: 0, fontSize: 11, lineHeight: 1.4, fontFamily: pickFont(rtl) },
    row: { flexDirection: 'row' },
    sidebar: { width: '30%', backgroundColor: p.accent, color: p.onAccent || '#fff', padding: 18, minHeight: '100%' },
    main: { width: '70%', padding: 24 },
    name: { fontSize: 22, fontWeight: 700, color: p.onAccent || '#fff' },
    pill: { backgroundColor: '#ffffff', color: p.accent, borderRadius: 9999, paddingHorizontal: 8, paddingVertical: 2, fontSize: 9, marginRight: 6, marginTop: 6 },
    label: { fontSize: 11, color: p.onAccent || '#fff', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
    chipContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 4 },
    chipDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFE200', marginRight: 4 },
    chipText: { fontSize: 9, color: p.accent },
    section: { marginTop: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    yellowDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#FFE200' },
    title: { fontSize: 12, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 },
    bullets: { marginTop: 4, paddingLeft: rtl ? 0 : 10, paddingRight: rtl ? 10 : 0 },
    bullet: { marginBottom: 3, textAlign: rtl ? 'right' : 'left' },
    sub: { color: '#6b7280' },
  })
  const name = cv.fullName || cv?.personalInfo?.fullName || 'Unnamed Candidate'
  const email = cv.email || cv?.personalInfo?.email || ''
  const phone = cv.phone || cv?.personalInfo?.phone || ''
  const location = cv.location || cv?.personalInfo?.location || ''
  const summary = cv.summary || cv?.personalInfo?.summary || ''
  const education = safeArray<any>(cv.education)
  const experience = safeArray<any>(cv.experience || (cv.experienceProjects || []).filter((it: any) => !it.type || it.type === 'experience'))
  const projects = safeArray<any>(cv.projects || (cv.experienceProjects || []).filter((it: any) => it.type === 'project'))
  const tech = safeArray<string>(cv?.skills?.technical)
  const langs = safeArray<string>(cv?.skills?.languages)
  const soft = safeArray<string>(cv?.skills?.soft)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.row}>
          <View style={s.sidebar}>
            <Text style={s.name}>{name}</Text>
            {location ? <Text>{location}</Text> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {email ? <Text style={s.pill}>{email}</Text> : null}
              {phone ? <Text style={s.pill}>{phone}</Text> : null}
            </View>
            {(tech.length > 0 || langs.length > 0 || soft.length > 0) && (
              <View>
                <Text style={s.label}>Skills</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {tech.slice(0, 24).map((t, i) => (
                    <View key={i} style={s.chipContainer}>
                      <View style={s.chipDot} />
                      <Text style={s.chipText}>{t}</Text>
                    </View>
                  ))}
                </View>
                {langs.length > 0 && <Text style={{ color: p.onAccent || '#fff', marginTop: 6 }}>Languages: {langs.join(', ')}</Text>}
              </View>
            )}
          </View>
          <View style={s.main}>
            {summary ? (
              <View style={s.section}>
                <View style={s.titleRow}>
                  <View style={s.yellowDot} />
                  <Text style={s.title}>Professional Summary</Text>
                </View>
                <Text style={s.sub}>{summary}</Text>
              </View>
            ) : null}

            {experience.length > 0 && (
              <View style={s.section}>
                <View style={s.titleRow}>
                  <View style={s.yellowDot} />
                  <Text style={s.title}>Experience</Text>
                </View>
                {experience.map((e: any, i: number) => (
                  <View key={i} style={{ marginTop: 6 }}>
                    <Text>{[e.position || e.title, e.company].filter(Boolean).join(' • ')}</Text>
                    <Text style={s.sub}>{[e.location, [e.startDate, e.endDate || (e.current ? 'Present' : '')].filter(Boolean).join(' - ')].filter(Boolean).join(' • ')}</Text>
                    {safeArray<string>(e.bullets).slice(0, 6).length > 0 && (
                      <View style={s.bullets}>
                        {safeArray<string>(e.bullets).slice(0, 6).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {projects.length > 0 && (
              <View style={s.section}>
                <View style={s.titleRow}>
                  <View style={s.yellowDot} />
                  <Text style={s.title}>Projects</Text>
                </View>
                {projects.map((p: any, i: number) => (
                  <View key={i} style={{ marginTop: 6 }}>
                    <Text>{p.name}</Text>
                    {p.description ? <Text style={s.sub}>{p.description}</Text> : null}
                    {safeArray<string>(p.bullets).slice(0, 5).map((b, bi) => (<Text key={bi} style={s.bullet}>• {b}</Text>))}
                  </View>
                ))}
              </View>
            )}

            {education.length > 0 && (
              <View style={s.section}>
                <View style={s.titleRow}>
                  <View style={s.yellowDot} />
                  <Text style={s.title}>Education</Text>
                </View>
                {education.map((e: any, i: number) => (
                  <View key={i} style={{ marginTop: 6 }}>
                    <Text>{[e.degree, e.institution].filter(Boolean).join(' • ')}</Text>
                    <Text style={s.sub}>{[e.location, [e.startDate, e.endDate].filter(Boolean).join(' - ')].filter(Boolean).join(' • ')}</Text>
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

export function createCVDocument(cv: any = {}, template: CVTemplate = 'minimal', language?: string) {
  const chosen: CVTemplate = (cv?.template as CVTemplate) || template || 'minimal'
  switch (chosen) {
    case 'modern':
      return <ModernPDFTemplate cv={cv} language={language} />
    case 'creative':
      return <CreativePDFTemplate cv={cv} language={language} />
    case 'minimal':
    default:
      return <MinimalPDFTemplate cv={cv} language={language} />
  }
}
