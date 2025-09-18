import { sql } from '@vercel/postgres'
import React from 'react'
import { MinimalTemplate } from '@/components/cv-templates/minimal-template'
import { ModernTemplate } from '@/components/cv-templates/modern-template'
import { CreativeTemplate } from '@/components/cv-templates/creative-template'
import { CVData } from '@/lib/cv-schemas'

export const dynamic = 'force-dynamic'

function isHtmlUrl(url?: string | null) {
  if (!url) return false
  const u = url.toLowerCase()
  return u.endsWith('.html') || u.includes('text/html')
}

async function fetchHtmlContent(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('text/html')) {
      // Some blob URLs omit content-type; still try to parse as text
      const text = await res.text()
      return text
    }
    return await res.text()
  } catch {
    return null
  }
}

export default async function PrintCVPage({ searchParams }: { searchParams: { id?: string; token?: string } }) {
  const idParam = searchParams?.id
  const token = (searchParams?.token || '').trim()

  // Basic gate using admin key (avoid exposing PII on a public route)
  const envKey = (process.env.ADMIN_KEY || '').trim()
  const devFallback = process.env.NODE_ENV !== 'production' ? 'test-admin-key' : ''
  const allowed = [envKey, devFallback].filter(Boolean)
  if (!token || !allowed.includes(token)) {
    return (
      <div className="cv-root" style={{ padding: 24 }}>
        <h1>Unauthorized</h1>
        <p className="muted">Missing or invalid admin token.</p>
      </div>
    )
  }

  const id = idParam ? Number(idParam) : NaN
  if (!Number.isFinite(id)) {
    return (
      <div className="cv-root" style={{ padding: 24 }}>
        <h1>Invalid request</h1>
        <p className="muted">A valid id query parameter is required.</p>
      </div>
    )
  }

  // Ensure columns for JSON CV storage exist (idempotent)
  try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_json JSONB`; } catch {}
  try { await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_template TEXT`; } catch {}

  const result = await sql<{
    id: number;
    full_name: string;
    email: string;
    phone: string | null;
    field_of_study: string | null;
    area_of_interest: string | null;
    cv_type: string | null;
    cv_url: string | null;
    gpa: any;
    cv_json: any | null;
    cv_template: string | null;
  }>`
    SELECT id, full_name, email, phone, field_of_study, area_of_interest, cv_type, cv_url, gpa, cv_json, cv_template
    FROM students WHERE id = ${id} LIMIT 1
  `
  const student = result.rows[0]

  if (!student) {
    return (
      <div className="cv-root" style={{ padding: 24 }}>
        <h1>Not found</h1>
        <p className="muted">No student record found for id {id}.</p>
      </div>
    )
  }

  // Try to render from stored JSON first
  let cvData: CVData | null = null
  try {
    if (student.cv_json) {
      cvData = student.cv_json as CVData
    }
  } catch {}

  // If no JSON available, fallback to embedding AI HTML
  let embeddedHtml: string | null = null
  if (!cvData && (student.cv_type || '').toLowerCase() === 'ai' && isHtmlUrl(student.cv_url || '')) {
    embeddedHtml = await fetchHtmlContent(student.cv_url as string)
  }

  // If JSON exists, render chosen template SSR
  if (cvData) {
    const templateKey = (student.cv_template || 'minimal').toLowerCase()
    return (
      <div className="cv-root">
        {templateKey === 'modern' ? (
          <ModernTemplate data={cvData} />
        ) : templateKey === 'creative' ? (
          <CreativeTemplate data={cvData} />
        ) : (
          <MinimalTemplate data={cvData} />
        )}
      </div>
    )
  }

  // Fallbacks
  if (embeddedHtml) {
    return (
      <div className="cv-root" dangerouslySetInnerHTML={{ __html: embeddedHtml }} />
    )
  }

  // Last-resort lightweight header
  return (
    <div className="cv-root" style={{ padding: 16 }}>
      <h1 style={{ margin: 0 }}>{student.full_name}</h1>
      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
        <span>{student.email}</span>
        {student.phone ? <span> • {student.phone}</span> : null}
        {student.field_of_study ? <span> • {student.field_of_study}</span> : null}
        {student.area_of_interest ? <span> • {student.area_of_interest}</span> : null}
      </div>
      <div className="rule" />
      <p className="muted" style={{ marginTop: 8 }}>Printable CV content is not available for this record.</p>
    </div>
  )
}
