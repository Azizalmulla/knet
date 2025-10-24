import { NextRequest, NextResponse } from 'next/server'

// Reject common free email domains for "Work Email"
const FREE_DOMAINS = new Set<string>([
  'gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com','aol.com','msn.com','live.com','gmx.com','proton.me','protonmail.com','yandex.com','mail.com','zoho.com'
])

function isBusinessEmail(email: string) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(email)) return false
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return !FREE_DOMAINS.has(domain)
}

async function sendWithResend({ from, to, subject, html }: { from: string; to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY not set' }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { ok: false, error: `Resend error: ${res.status} ${text}` }
  }
  return { ok: true }
}

function escapeHtml(str: string) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as any

    const companyName = String(body.companyName || '').trim()
    const website = String(body.website || '').trim()
    const contactName = String(body.contactName || '').trim()
    const workEmail = String(body.workEmail || '').trim()
    const phone = String(body.phone || '').trim()
    const employeeCount = String(body.employeeCount || '').trim()
    const desiredOrgSlug = String(body.desiredOrgSlug || '').trim()
    const message = String(body.message || '').trim()

    // Honeypot
    const honeypot = String(body.honeypot || body.company_website || '').trim()
    if (honeypot) return NextResponse.json({ ok: true })

    if (!companyName || !contactName || !workEmail || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!isBusinessEmail(workEmail)) {
      return NextResponse.json({ error: 'Please use a valid business email' }, { status: 400 })
    }
    if (message.length < 20) {
      return NextResponse.json({ error: 'Message should be at least 20 characters' }, { status: 400 })
    }

    const to = process.env.ENROLL_TO || 'azizalmulla16@gmail.com'
    const from = process.env.RESEND_FROM || 'Wathefni AI <onboarding@resend.dev>'

    const suggestedSlug = desiredOrgSlug || companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111">
        <h2>New Company Enrollment</h2>
        <p><strong>Company:</strong> ${escapeHtml(companyName)}</p>
        ${website ? `<p><strong>Website:</strong> ${escapeHtml(website)}</p>` : ''}
        <p><strong>Contact:</strong> ${escapeHtml(contactName)}</p>
        <p><strong>Work Email:</strong> ${escapeHtml(workEmail)}</p>
        ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
        ${employeeCount ? `<p><strong>Employees:</strong> ${escapeHtml(employeeCount)}</p>` : ''}
        ${desiredOrgSlug ? `<p><strong>Requested org slug:</strong> ${escapeHtml(desiredOrgSlug)}</p>` : ''}
        <p><strong>Suggested slug:</strong> ${escapeHtml(suggestedSlug)}</p>
        <hr/>
        <p><strong>Message</strong></p>
        <pre style="white-space: pre-wrap; background:#fafafa; padding:12px; border-radius:8px;">${escapeHtml(message)}</pre>
      </div>
    `

    const result = await sendWithResend({ from, to, subject: `Wathefni AI Company Enrollment: ${companyName}`, html })
    if (!result.ok) {
      console.log('[ENROLL - EMAIL NOT SENT]', { companyName, contactName, workEmail, website, phone, employeeCount, desiredOrgSlug, message, error: result.error })
      return NextResponse.json({ ok: true, note: 'Received. Email provider not configured; enrollment logged on server.' })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Enroll submit error', err)
    return NextResponse.json({ error: 'Failed to submit enrollment' }, { status: 500 })
  }
}
