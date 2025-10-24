import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@/lib/pdf/react-pdf-shim'
import type { CVData } from '@/lib/cv-schemas'

export type TemplateKind = 'minimal' | 'modern' | 'creative'

function normalize(data: CVData) {
  const exp = Array.isArray((data as any).experience) ? (data as any).experience : []
  const projects = Array.isArray((data as any).projects) ? (data as any).projects : []
  const expProj = Array.isArray((data as any).experienceProjects) ? (data as any).experienceProjects : []
  const education = Array.isArray((data as any).education) ? (data as any).education : []

  return { exp, projects, expProj, education }
}

const baseStyles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontSize: 11,
    fontFamily: 'Helvetica',
  },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 6 },
  h2: { fontSize: 14, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  p: { fontSize: 11, lineHeight: 1.4, marginBottom: 6 },
  small: { fontSize: 10, color: '#444' },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  bullet: { fontSize: 11, marginBottom: 4 },
  hr: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
})

function Minimal({ data }: { data: CVData }) {
  const { exp, projects, expProj, education } = normalize(data)
  return (
    <Document>
      <Page size="A4" style={baseStyles.page}>
        <View>
          <Text style={baseStyles.h1}>{data.fullName || ''}</Text>
          <Text style={baseStyles.small}>{[data.email, data.phone, data.location].filter(Boolean).join(' | ')}</Text>
        </View>
        {data.summary ? (
          <View>
            <Text style={baseStyles.h2}>Professional Summary</Text>
            <Text style={baseStyles.p}>{data.summary}</Text>
          </View>
        ) : null}

        {education?.length ? (
          <View>
            <Text style={baseStyles.h2}>Education</Text>
            {education.map((edu: any, idx: number) => (
              <View key={idx}>
                <Text style={baseStyles.p}>
                  {(edu.degree || '') + (edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : '')}
                </Text>
                <Text style={baseStyles.small}>
                  {[
                    edu.institution,
                    [edu.startDate || edu.graduationDate || '', (edu.endDate || (edu.currentlyStudying ? 'Present' : ''))].filter(Boolean).join(' - ')
                  ].filter(Boolean).join(' • ')}
                </Text>
                {edu.gpa ? <Text style={baseStyles.small}>GPA: {String(edu.gpa)}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {(exp?.length || expProj?.length) ? (
          <View>
            <Text style={baseStyles.h2}>Experience</Text>
            {exp.map((e: any, idx: number) => (
              <View key={`e-${idx}`}>
                <Text style={baseStyles.p}>
                  {(e.position || '') + (e.company ? ` - ${e.company}` : '')}
                </Text>
                <Text style={baseStyles.small}>{[e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' • ')}</Text>
                {(e.bullets || []).map((b: string, i: number) => (
                  <Text key={`eb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
            {expProj.filter((x: any) => x?.type === 'experience').map((e: any, idx: number) => (
              <View key={`ep-${idx}`}>
                <Text style={baseStyles.p}>
                  {(e.position || '') + (e.company ? ` - ${e.company}` : '')}
                </Text>
                <Text style={baseStyles.small}>{[e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' • ')}</Text>
                {(e.bullets || []).map((b: string, i: number) => (
                  <Text key={`epb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {(projects?.length || expProj?.some((x: any) => x?.type === 'project')) ? (
          <View>
            <Text style={baseStyles.h2}>Projects</Text>
            {projects.map((p: any, idx: number) => (
              <View key={`p-${idx}`}>
                <Text style={baseStyles.p}>{p.name}</Text>
                <Text style={baseStyles.small}>{p.description}</Text>
                {(p.technologies || []).length ? (
                  <Text style={baseStyles.small}>Technologies: {(p.technologies || []).join(', ')}</Text>
                ) : null}
                {(p.bullets || []).map((b: string, i: number) => (
                  <Text key={`pb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
            {expProj.filter((x: any) => x?.type === 'project').map((p: any, idx: number) => (
              <View key={`pp-${idx}`}>
                <Text style={baseStyles.p}>{p.name}</Text>
                <Text style={baseStyles.small}>{p.description}</Text>
                {(p.technologies || []).length ? (
                  <Text style={baseStyles.small}>Technologies: {(p.technologies || []).join(', ')}</Text>
                ) : null}
                {(p.bullets || []).map((b: string, i: number) => (
                  <Text key={`ppb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {data.skills ? (
          <View>
            <Text style={baseStyles.h2}>Skills</Text>
            {(data.skills.technical || []).length ? (
              <Text style={baseStyles.p}>Technical: {(data.skills.technical || []).join(', ')}</Text>
            ) : null}
            {(data.skills.languages || []).length ? (
              <Text style={baseStyles.p}>Languages: {(data.skills.languages || []).join(', ')}</Text>
            ) : null}
            {(data.skills.soft || []).length ? (
              <Text style={baseStyles.p}>Soft: {(data.skills.soft || []).join(', ')}</Text>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

const modernStyles = StyleSheet.create({
  page: { ...baseStyles.page },
  header: { backgroundColor: '#1b4dff', color: '#fff', padding: 12, borderRadius: 6, marginBottom: 10 },
  name: { fontSize: 20, fontWeight: 700, color: '#fff' },
  line: { fontSize: 10, color: '#e5e7eb' },
  sectionHeader: { fontSize: 12, color: '#1b4dff', textTransform: 'uppercase', marginTop: 10, marginBottom: 4, fontWeight: 700 },
  itemTitle: { fontSize: 11, fontWeight: 700 },
  meta: { fontSize: 10, color: '#444' },
})

function Modern({ data }: { data: CVData }) {
  const { exp, projects, expProj, education } = normalize(data)
  return (
    <Document>
      <Page size="A4" style={modernStyles.page}>
        <View style={modernStyles.header}>
          <Text style={modernStyles.name}>{data.fullName || ''}</Text>
          <Text style={modernStyles.line}>{[data.email, data.phone, data.location].filter(Boolean).join(' • ')}</Text>
        </View>

        {data.summary ? (
          <View>
            <Text style={modernStyles.sectionHeader}>Professional Summary</Text>
            <Text style={baseStyles.p}>{data.summary}</Text>
          </View>
        ) : null}

        {education?.length ? (
          <View>
            <Text style={modernStyles.sectionHeader}>Education</Text>
            {education.map((edu: any, idx: number) => (
              <View key={idx}>
                <Text style={modernStyles.itemTitle}>{(edu.degree || '') + (edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : '')}</Text>
                <Text style={modernStyles.meta}>
                  {[
                    edu.institution,
                    [edu.startDate || edu.graduationDate || '', (edu.endDate || (edu.currentlyStudying ? 'Present' : ''))].filter(Boolean).join(' - ')
                  ].filter(Boolean).join(' • ')}
                </Text>
                {edu.gpa ? <Text style={modernStyles.meta}>GPA: {String(edu.gpa)}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {(exp?.length || expProj?.length) ? (
          <View>
            <Text style={modernStyles.sectionHeader}>Experience</Text>
            {exp.map((e: any, idx: number) => (
              <View key={`e-${idx}`}>
                <Text style={modernStyles.itemTitle}>{(e.position || '') + (e.company ? ` - ${e.company}` : '')}</Text>
                <Text style={modernStyles.meta}>{[e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' • ')}</Text>
                {(e.bullets || []).map((b: string, i: number) => (
                  <Text key={`eb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
            {expProj.filter((x: any) => x?.type === 'experience').map((e: any, idx: number) => (
              <View key={`ep-${idx}`}>
                <Text style={modernStyles.itemTitle}>{(e.position || '') + (e.company ? ` - ${e.company}` : '')}</Text>
                <Text style={modernStyles.meta}>{[e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' • ')}</Text>
                {(e.bullets || []).map((b: string, i: number) => (
                  <Text key={`epb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {(projects?.length || expProj?.some((x: any) => x?.type === 'project')) ? (
          <View>
            <Text style={modernStyles.sectionHeader}>Projects</Text>
            {projects.map((p: any, idx: number) => (
              <View key={`p-${idx}`}>
                <Text style={modernStyles.itemTitle}>{p.name}</Text>
                <Text style={modernStyles.meta}>{p.description}</Text>
                {(p.technologies || []).length ? (
                  <Text style={modernStyles.meta}>Technologies: {(p.technologies || []).join(', ')}</Text>
                ) : null}
                {(p.bullets || []).map((b: string, i: number) => (
                  <Text key={`pb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
            {expProj.filter((x: any) => x?.type === 'project').map((p: any, idx: number) => (
              <View key={`pp-${idx}`}>
                <Text style={modernStyles.itemTitle}>{p.name}</Text>
                <Text style={modernStyles.meta}>{p.description}</Text>
                {(p.technologies || []).length ? (
                  <Text style={modernStyles.meta}>Technologies: {(p.technologies || []).join(', ')}</Text>
                ) : null}
                {(p.bullets || []).map((b: string, i: number) => (
                  <Text key={`ppb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {data.skills ? (
          <View>
            <Text style={modernStyles.sectionHeader}>Skills</Text>
            {(data.skills.technical || []).length ? (
              <Text style={baseStyles.p}>Technical: {(data.skills.technical || []).join(', ')}</Text>
            ) : null}
            {(data.skills.languages || []).length ? (
              <Text style={baseStyles.p}>Languages: {(data.skills.languages || []).join(', ')}</Text>
            ) : null}
            {(data.skills.soft || []).length ? (
              <Text style={baseStyles.p}>Soft: {(data.skills.soft || []).join(', ')}</Text>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

const creativeStyles = StyleSheet.create({
  page: { ...baseStyles.page },
  banner: { backgroundColor: '#6d28d9', color: '#fff', padding: 14, borderRadius: 10, marginBottom: 10 },
  name: { fontSize: 22, fontWeight: 700, color: '#fff' },
  info: { fontSize: 10, color: '#f3e8ff' },
  sectionHeader: { fontSize: 12, color: '#6d28d9', textTransform: 'uppercase', marginTop: 10, marginBottom: 4, fontWeight: 700 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  chip: { backgroundColor: '#ede9fe', color: '#5b21b6', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, fontSize: 10, marginRight: 4, marginBottom: 4 },
  itemTitle: { fontSize: 11, fontWeight: 700 },
  meta: { fontSize: 10, color: '#444' },
})

function Creative({ data }: { data: CVData }) {
  const { exp, projects, expProj, education } = normalize(data)
  return (
    <Document>
      <Page size="A4" style={creativeStyles.page}>
        <View style={creativeStyles.banner}>
          <Text style={creativeStyles.name}>{data.fullName || ''}</Text>
          <Text style={creativeStyles.info}>{[data.email, data.phone, data.location].filter(Boolean).join(' • ')}</Text>
        </View>

        {data.summary ? (
          <View>
            <Text style={creativeStyles.sectionHeader}>Profile</Text>
            <Text style={baseStyles.p}>{data.summary}</Text>
          </View>
        ) : null}

        {education?.length ? (
          <View>
            <Text style={creativeStyles.sectionHeader}>Education</Text>
            {education.map((edu: any, idx: number) => (
              <View key={idx}>
                <Text style={creativeStyles.itemTitle}>{(edu.degree || '') + (edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : '')}</Text>
                <Text style={creativeStyles.meta}>
                  {[
                    edu.institution,
                    [edu.startDate || edu.graduationDate || '', (edu.endDate || (edu.currentlyStudying ? 'Present' : ''))].filter(Boolean).join(' - ')
                  ].filter(Boolean).join(' • ')}
                </Text>
                {edu.gpa ? <Text style={creativeStyles.meta}>GPA: {String(edu.gpa)}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}

        {(exp?.length || expProj?.length) ? (
          <View>
            <Text style={creativeStyles.sectionHeader}>Experience</Text>
            {exp.map((e: any, idx: number) => (
              <View key={`e-${idx}`}>
                <Text style={creativeStyles.itemTitle}>{(e.position || '') + (e.company ? ` - ${e.company}` : '')}</Text>
                <Text style={creativeStyles.meta}>{[e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' • ')}</Text>
                {(e.bullets || []).map((b: string, i: number) => (
                  <Text key={`eb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
            {expProj.filter((x: any) => x?.type === 'experience').map((e: any, idx: number) => (
              <View key={`ep-${idx}`}>
                <Text style={creativeStyles.itemTitle}>{(e.position || '') + (e.company ? ` - ${e.company}` : '')}</Text>
                <Text style={creativeStyles.meta}>{[e.startDate, e.current ? 'Present' : e.endDate].filter(Boolean).join(' • ')}</Text>
                {(e.bullets || []).map((b: string, i: number) => (
                  <Text key={`epb-${i}`} style={baseStyles.bullet}>• {b}</Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {(projects?.length || expProj?.some((x: any) => x?.type === 'project')) ? (
          <View>
            <Text style={creativeStyles.sectionHeader}>Projects</Text>
            {projects.map((p: any, idx: number) => (
              <View key={`p-${idx}`}>
                <Text style={creativeStyles.itemTitle}>{p.name}</Text>
                <Text style={creativeStyles.meta}>{p.description}</Text>
                {(p.technologies || []).length ? (
                  <View style={creativeStyles.chipRow}>
                    {(p.technologies || []).map((t: string, i: number) => (
                      <Text key={`pt-${i}`} style={creativeStyles.chip}>{t}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
            {expProj.filter((x: any) => x?.type === 'project').map((p: any, idx: number) => (
              <View key={`pp-${idx}`}>
                <Text style={creativeStyles.itemTitle}>{p.name}</Text>
                <Text style={creativeStyles.meta}>{p.description}</Text>
                {(p.technologies || []).length ? (
                  <View style={creativeStyles.chipRow}>
                    {(p.technologies || []).map((t: string, i: number) => (
                      <Text key={`ppt-${i}`} style={creativeStyles.chip}>{t}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {data.skills ? (
          <View>
            <Text style={creativeStyles.sectionHeader}>Skills</Text>
            {(data.skills.technical || []).length ? (
              <View style={creativeStyles.chipRow}>
                {(data.skills.technical || []).map((t: string, i: number) => (
                  <Text key={`st-${i}`} style={creativeStyles.chip}>{t}</Text>
                ))}
              </View>
            ) : null}
            {(data.skills.languages || []).length ? (
              <Text style={baseStyles.p}>Languages: {(data.skills.languages || []).join(', ')}</Text>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  )
}

export function buildDocument(data: CVData, template: TemplateKind) {
  if (template === 'modern') return <Modern data={data} />
  if (template === 'creative') return <Creative data={data} />
  return <Minimal data={data} />
}
