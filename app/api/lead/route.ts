import { NextRequest, NextResponse } from 'next/server'

// Simple set of common free email domains to reject for "Work Email"
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as any
    const companyName = String(body.companyName || '').trim()
    const contactPerson = String(body.contactPerson || '').trim()
    const email = String(body.email || '').trim()
    const phone = String(body.phone || '').trim()
    const message = String(body.message || '').trim()

    // Honeypot (accept either key if present)
    const honeypot = String(body.honeypot || body.company_website || '').trim()
    if (honeypot) {
      // Pretend success for bots
      return NextResponse.json({ ok: true })
    }

    if (!companyName || !contactPerson || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!isBusinessEmail(email)) {
      return NextResponse.json({ error: 'Please use a valid business email' }, { status: 400 })
    }
    if (message.length < 20) {
      return NextResponse.json({ error: 'Message should be at least 20 characters' }, { status: 400 })
    }

    const to = 'azizalmulla16@gmail.com'
    const from = process.env.RESEND_FROM || 'Careerly <onboarding@resend.dev>'

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111">
        <h2>New Company Lead</h2>
        <p><strong>Company:</strong> ${escapeHtml(companyName)}</p>
        <p><strong>Contact:</strong> ${escapeHtml(contactPerson)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
        <hr/>
        <p><strong>Message</strong></p>
        <pre style="white-space: pre-wrap; background:#fafafa; padding:12px; border-radius:8px;">${escapeHtml(message)}</pre>
      </div>
    `

    let sent = false
    let sendError: string | null = null

    // Try Resend if configured
    const result = await sendWithResend({ from, to, subject: `Careerly Lead: ${companyName}`, html })
    if (result.ok) {
      sent = true
    } else {
      sendError = result.error || 'Unknown send error'
      // Fallback: log to server (so lead isn't lost)
      console.log('[LEAD - EMAIL NOT SENT]', { companyName, contactPerson, email, phone, message, error: sendError })
    }

    if (!sent) {
      // Still return 200 to avoid blocking the user; include info message
      return NextResponse.json({ ok: true, note: 'Received. Email provider not configured; lead logged on server.' })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Lead submit error', err)
    return NextResponse.json({ error: 'Failed to submit lead' }, { status: 500 })
  }
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
