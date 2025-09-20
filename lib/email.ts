import { NextRequest } from 'next/server'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

async function sendViaResend(opts: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY!
  const from = opts.from || process.env.RESEND_FROM || 'noreply@careerly.app'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html
    })
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`RESEND_FAILED_${res.status}:${txt}`)
  }
}

async function sendViaSendGrid(opts: SendEmailOptions) {
  const apiKey = process.env.SENDGRID_API_KEY!
  const from = opts.from || process.env.SENDGRID_FROM || 'noreply@careerly.app'
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: opts.to }] }],
      from: { email: from },
      subject: opts.subject,
      content: [{ type: 'text/html', value: opts.html }]
    })
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`SENDGRID_FAILED_${res.status}:${txt}`)
  }
}

export async function sendEmail(opts: SendEmailOptions) {
  try {
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(opts)
    }
    if (process.env.SENDGRID_API_KEY) {
      return await sendViaSendGrid(opts)
    }
    console.log('[EMAIL_FALLBACK]', { to: opts.to, subject: opts.subject, html: opts.html.substring(0, 200) + '...' })
  } catch (e) {
    console.error('EMAIL_SEND_FAILED', e)
    throw e
  }
}
