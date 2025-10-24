# Inbound Email CV Submission - Setup Complete ✅

## What Was Built

Students can now submit CVs by sending an email to:
```
submit@watheefni.ai
```

The system automatically:
1. ✅ Receives the email
2. ✅ Extracts PDF attachment
3. ✅ Uploads to Vercel Blob
4. ✅ Adds candidate to ALL public organizations
5. ✅ Sends confirmation email to student

---

## Setup Steps

### ✅ Step 1: DNS Verified (DONE)
Your domain can now receive emails.

### ✅ Step 2: API Endpoint Created (DONE)
Created: `app/api/inbound/cv/route.ts`

### 🔄 Step 3: Create Inbound Route in Resend (DO THIS NOW)

1. Go to Resend dashboard
2. Click **"Inbound"** in sidebar
3. Click **"Create Route"** or **"Add Route"**
4. Fill in:
   ```
   Email Address: submit@watheefni.ai
   Webhook URL: https://watheefni.ai/api/inbound/cv
   Description: CV Submissions
   ```
5. Click **"Save"** or **"Create"**

### 🚀 Step 4: Deploy (DO THIS AFTER STEP 3)
```bash
vercel --prod
```

---

## How It Works

### Student Experience:

**1. Student sends email:**
```
To: submit@watheefni.ai
Subject: Software Engineer Application - Ahmed Ali
Attachment: ahmed_cv.pdf

Body:
Hi, I'm interested in software engineering positions.
I have 3 years of experience in React and Node.js.
```

**2. Student receives confirmation:**
```
Subject: CV Received Successfully ✓

Hi Ahmed Ali,

We've successfully received your CV and added you to our candidate database.

Your profile has been submitted to:
- KNET
- Boubyan Bank
- National Bank of Kuwait
- Careerly

Our AI will analyze your CV and match you with relevant opportunities.

Best regards,
Watheefni AI Team
```

---

## Admin Experience:

**All organization admins can now see the candidate:**
- KNET admin sees: Ahmed Ali (submitted via email)
- Boubyan admin sees: Ahmed Ali (submitted via email)
- NBK admin sees: Ahmed Ali (submitted via email)

**CV is automatically:**
- ✅ Stored in Vercel Blob
- ✅ Added to candidates table
- ✅ Status: Pending (ready for AI parsing)
- ✅ Visible in all org admin dashboards

---

## Features

### ✅ Automatic Organization Assignment
- Adds to ALL public organizations
- Maximum visibility for candidates
- Each org admin can view the candidate

### ✅ Smart Name Extraction
Tries to extract name from:
1. Email subject: "Application - John Doe"
2. Email address: john.doe@gmail.com → "John Doe"

### ✅ File Validation
- Only accepts PDF files
- Max size: 10MB
- Sends error email if invalid

### ✅ Error Handling
If something goes wrong, student receives helpful email:
- No PDF found → Instructions to attach PDF
- File too large → Instructions to compress
- Service error → Link to website

### ✅ Confirmation Emails
Success email includes:
- List of organizations submitted to
- What happens next
- Link to website

---

## Testing

### Test 1: Send Valid Email
```
To: submit@watheefni.ai
Subject: Test Application - Test User
Attachment: test_cv.pdf (any PDF)

Expected:
✅ Confirmation email received
✅ Candidate appears in all org admin dashboards
✅ PDF stored in Vercel Blob
```

### Test 2: Send Email Without PDF
```
To: submit@watheefni.ai
Subject: Test Application
Body: Here's my CV
(no attachment)

Expected:
❌ Error email received
📧 "Please attach your CV as a PDF file"
```

### Test 3: Send Large File
```
To: submit@watheefni.ai
Attachment: huge_cv.pdf (>10MB)

Expected:
❌ Error email received
📧 "File too large (max 10MB)"
```

---

## Server Logs

When email is received, you'll see:
```
[INBOUND CV] Received email from: ahmed@gmail.com
[INBOUND CV] Subject: Software Engineer Application - Ahmed Ali
[INBOUND CV] Attachments: 1
[INBOUND CV] Uploading PDF to Vercel Blob...
[INBOUND CV] PDF uploaded: https://blob.vercel-storage.com/...
[INBOUND CV] Added to KNET (knet): abc-123
[INBOUND CV] Added to Boubyan Bank (boubyan): def-456
[INBOUND CV] Added to National Bank of Kuwait (nbk): ghi-789
[INBOUND CV] Success email sent to: ahmed@gmail.com
[INBOUND CV] Success! Added to 3 organizations
```

---

## Database Schema

Candidates are added with:
```sql
INSERT INTO candidates (
  organization_id,    -- Each public org gets a copy
  full_name,          -- Extracted from email
  email,              -- Sender's email
  cv_blob_key,        -- Vercel Blob URL
  cv_type,            -- 'uploaded'
  parse_status,       -- 'pending' (ready for AI parsing)
  created_at          -- Timestamp
)
```

---

## Environment Variables

Required:
```bash
# Vercel Blob (for CV storage)
BLOB_READ_WRITE_TOKEN=vercel_blob_...

# Resend (for confirmation emails)
RESEND_API_KEY=re_abc123xyz

# Database
POSTGRES_URL=postgres://...
```

---

## Security

### Webhook Verification (Optional)
To verify requests are from Resend:
```typescript
const signature = request.headers.get('resend-signature')
// Verify signature matches
```

### Rate Limiting (Optional)
Prevent spam:
```typescript
// Check if email sent too many CVs recently
const recentSubmissions = await sql`
  SELECT COUNT(*) FROM candidates 
  WHERE email = ${senderEmail} 
    AND created_at > now() - interval '1 hour'
`
if (recentSubmissions.rows[0].count > 5) {
  return sendErrorEmail(senderEmail, 'too-many-submissions')
}
```

---

## Customization

### Change Email Address
In Resend dashboard, you can create multiple routes:
```
submit@watheefni.ai     → All orgs
careers@watheefni.ai    → All orgs
knet@watheefni.ai       → Only KNET
boubyan@watheefni.ai    → Only Boubyan
```

### Filter by Organization
Modify the code to assign to specific orgs:
```typescript
// Instead of all public orgs
const orgs = await sql`
  SELECT id, slug, name 
  FROM organizations 
  WHERE slug = 'knet'  -- Only KNET
`
```

### Parse CV Immediately
Add AI parsing after upload:
```typescript
// After blob upload
const parsedCV = await parseCV(blob.url)
await sql`
  UPDATE candidates 
  SET 
    field_of_study = ${parsedCV.field},
    gpa = ${parsedCV.gpa},
    parse_status = 'completed'
  WHERE id = ${candidateId}
`
```

---

## Troubleshooting

### Issue: Emails not received
**Check:**
1. DNS MX record is set correctly
2. Resend shows "Verified" status
3. Inbound route is active
4. Email address matches route

### Issue: Webhook not called
**Check:**
1. Webhook URL is correct: `https://watheefni.ai/api/inbound/cv`
2. API endpoint is deployed (not localhost)
3. Endpoint returns 200 OK
4. Check Resend webhook logs

### Issue: No confirmation email sent
**Check:**
1. `RESEND_API_KEY` is set in environment
2. Check server logs for email errors
3. Check Resend dashboard for delivery status
4. Check spam folder

### Issue: Candidate not appearing in admin dashboard
**Check:**
1. Organization is public (`is_public = true`)
2. Organization not deleted (`deleted_at IS NULL`)
3. Check database for candidate record
4. Refresh admin dashboard

---

## Next Steps

### Now:
1. ✅ Create inbound route in Resend
2. ✅ Deploy: `vercel --prod`
3. ✅ Test by sending email to `submit@watheefni.ai`

### Later (Optional):
- Add AI CV parsing on submission
- Add per-organization email addresses
- Add webhook signature verification
- Add rate limiting
- Add admin notifications for new submissions

---

## Marketing

**Promote the email submission feature:**

### On Website:
```
Submit Your CV
📧 Email: submit@watheefni.ai
🌐 Web: watheefni.ai/start
```

### Social Media:
```
🎯 New! Submit your CV via email

Just send your CV to:
submit@watheefni.ai

✅ Instant confirmation
✅ Automatic matching
✅ Multiple organizations

#JobSearch #Kuwait #Careers
```

### Email Signature:
```
Looking for talent? 
Send CVs to: submit@watheefni.ai
```

---

## Summary

### What Students Can Do:
- ✅ Email CV to `submit@watheefni.ai`
- ✅ Get instant confirmation
- ✅ Profile visible to all organizations
- ✅ Automatic AI matching (when implemented)

### What Admins See:
- ✅ New candidates in dashboard
- ✅ Source: "Email Submission"
- ✅ CV ready for review
- ✅ All candidate details

### What You Get:
- ✅ More CV submissions (lower friction)
- ✅ Better user experience
- ✅ Professional workflow
- ✅ Automated processing

**Status: Ready to deploy! 🚀**
