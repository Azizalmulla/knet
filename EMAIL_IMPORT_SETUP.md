# Email Auto-Import Setup Guide

## Overview

The email auto-import feature allows organizations to automatically import CVs from job application emails. When a candidate sends a CV to the company's email, it's automatically processed and added to the system.

---

## How It Works

```
Candidate → emails CV to applications@company.com
           ↓
Gmail/Outlook → auto-forwards to knet@import.wathefni.ai
           ↓
Resend Inbound → webhook to your API
           ↓
Your System → parses email + PDF + creates candidate
           ↓
Candidate ← confirmation email
Admin ← dashboard notification
```

---

## Setup Steps

### 1. Database Migration

Run the migration to create the `import_log` table:

```bash
# Connect to your Neon database
psql $DATABASE_URL -f scripts/migrations/006-import-log.sql
```

Or copy/paste the SQL from `scripts/migrations/006-import-log.sql` into your Neon SQL Editor.

### 2. Environment Variables

Add these to your `.env` file and Vercel environment variables:

```bash
# Resend API Key (for sending confirmation emails)
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# Resend From Email (verified domain)
# Must be verified in Resend dashboard
RESEND_FROM=noreply@wathefni.ai

# Internal API Token (for triggering CV parsing)
# Generate a secure random token
INTERNAL_API_TOKEN=your-random-secure-token-here

# App URL (for API callbacks)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Generate Internal Token:**
```bash
openssl rand -base64 32
```

### 3. Resend Inbound Email Setup

1. **Sign up at Resend** (if not already): https://resend.com

2. **Add Domain:**
   - Go to Domains → Add Domain
   - Add: `import.wathefni.ai` (or your subdomain)
   - Add the MX and TXT records to your DNS

3. **Configure Inbound Route:**
   - Go to Inbound → Create Route
   - Match: `*@import.wathefni.ai` (all emails)
   - Forward to: `https://your-domain.com/api/import/email`
   - Add webhook secret to verify requests (optional but recommended)

4. **DNS Records Example:**
```
Type: MX
Name: import.wathefni.ai
Value: inbound-smtp.resend.com
Priority: 10

Type: TXT
Name: import.wathefni.ai
Value: "v=spf1 include:_spf.resend.com ~all"
```

### 4. Organization Email Addresses

Each organization gets their own import email:

**Format:** `{org-slug}@import.wathefni.ai`

Examples:
- `knet@import.wathefni.ai`
- `careerly@import.wathefni.ai`
- `abc-company@import.wathefni.ai`

These are automatically handled by the webhook based on the organization slug in the database.

### 5. Gmail/Outlook Forwarding Setup

**For Gmail:**
1. Go to Settings → See all settings
2. Click "Forwarding and POP/IMAP"
3. Click "Add a forwarding address"
4. Enter: `knet@import.wathefni.ai`
5. Confirm via email
6. Create Filter:
   - Has attachment
   - Subject contains: "application" or "CV" or "resume"
   - Forward to: `knet@import.wathefni.ai`

**For Outlook:**
1. Settings → Mail → Rules
2. Add new rule
3. Condition: Has attachment
4. Action: Forward to `knet@import.wathefni.ai`

---

## Testing

### 1. Send Test Email

Send an email to `knet@import.wathefni.ai` with:

**Subject:** Application for Software Developer

**Body:**
```
Dear Hiring Team,

I am applying for the Software Developer position.

Name: John Doe
Phone: +965 12345678
Field of Study: Computer Science
GPA: 3.8

Best regards,
John
```

**Attach:** A PDF CV

### 2. Check Logs

Monitor Vercel logs:
```bash
vercel logs --follow
```

Look for:
```
[EMAIL_IMPORT] Received email: { from: 'john@example.com', ... }
[EMAIL_IMPORT] Parsed candidate data: { full_name: 'John Doe', ... }
[EMAIL_IMPORT] PDF uploaded: https://blob.vercel...
[EMAIL_IMPORT] Created candidate: uuid-here
[EMAIL_IMPORT] Success! Processed in 287ms
```

### 3. Verify in Dashboard

1. Go to admin dashboard → Import tab
2. Should see new import activity
3. Go to Students tab
4. Should see "John Doe" with parse status "QUEUED" or "COMPLETED"

---

## Email Parsing

The system uses AI (GPT-4o-mini) to extract candidate information from email text:

**Extracted Fields:**
- Full name
- Email address
- Phone number
- Field of study
- Area of interest
- GPA
- Degree (Bachelor's, Master's, etc.)
- Years of experience

**Fallback:** If AI extraction fails, uses regex patterns and email metadata.

---

## Confirmation Emails

Candidates automatically receive a confirmation email:

**Example:**
```
Subject: Application Received - KNET

Dear John Doe,

We have successfully received your CV and application materials for KNET.

Our team will review your application and contact you if your qualifications 
match our requirements.

Best regards,
KNET Hiring Team
```

---

## Cost Estimates

**Per Email Import:**
- Resend inbound: Free (first 100 emails/day)
- AI parsing (GPT-4o-mini): ~$0.0001
- Blob storage: ~$0.0001
- CV parsing + embedding: ~$0.0004
- Confirmation email: Free (first 100/day)

**Total: ~$0.0006 per CV import**

For 100 CVs/day: ~$0.06/day = ~$1.80/month

---

## Monitoring

### Dashboard Metrics

The Import tab shows:
- Email imports count (last 30 days)
- Total imported candidates
- CSV imports (Phase 2)
- Failed imports
- Recent activity feed

### Log Search

Search Vercel logs for issues:
```bash
vercel logs --filter "[EMAIL_IMPORT]"
```

---

## Troubleshooting

### Email not arriving at webhook

**Check:**
1. DNS records are correct (use `dig` or `nslookup`)
2. Resend inbound route is active
3. Webhook URL is correct and accessible
4. Organization slug exists in database

### Parsing fails

**Check:**
1. PDF attachment is valid
2. `OPENAI_API_KEY` is set
3. Vercel Blob is configured
4. Database connection is working

### No confirmation email sent

**Check:**
1. `RESEND_API_KEY` is set
2. `RESEND_FROM` domain is verified in Resend
3. Candidate email is valid
4. Check Resend dashboard for delivery status

---

## Security

### Webhook Validation

To prevent spam/abuse, add webhook signature validation:

```typescript
// In app/api/import/email/route.ts
const signature = request.headers.get('x-resend-signature')
const secret = process.env.RESEND_WEBHOOK_SECRET

if (signature !== secret) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
}
```

### Rate Limiting

The system uses existing rate limiting from `lib/rateLimit.ts`. Consider adding:

```typescript
// Limit emails per org per hour
const limit = await checkRateLimitWithConfig(
  `email_import:${orgSlug}`,
  { maxRequests: 50, windowMs: 3600000 } // 50/hour
)
```

---

## Phase 2 Features (Coming Soon)

- ✅ Email auto-import (Phase 1 - Current)
- 🔜 CSV bulk upload
- 🔜 PDF ZIP bulk upload
- 🔜 Public API for integrations
- 🔜 WhatsApp integration
- 🔜 LinkedIn direct import

---

## Support

If you encounter issues:

1. Check Vercel logs: `vercel logs --follow`
2. Check Resend logs: https://resend.com/logs
3. Check Neon database: Query `import_log` table
4. Test with curl:

```bash
curl -X POST https://your-domain.com/api/import/email \
  -H "Content-Type: application/json" \
  -d '{
    "from": "test@example.com",
    "to": "knet@import.wathefni.ai",
    "subject": "Test Application",
    "text": "Name: Test User\nPhone: +965 12345678",
    "attachments": []
  }'
```

---

## Success Metrics

After setup, you should see:
- ✅ 0 manual CV uploads needed
- ✅ < 30 second processing time per CV
- ✅ 100% of emailed CVs auto-imported
- ✅ Candidates receive instant confirmation
- ✅ HR gets real-time notifications

**This eliminates 3-5 minutes of manual work per CV!**
