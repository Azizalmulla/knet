# 📋 Email Auto-Import Deployment Checklist

Complete these steps in order to activate the email auto-import feature.

---

## ✅ Phase 1: Database Setup (5 minutes)

### Step 1: Run Migration

Run the SQL migration to create the `import_log` table:

**Option A: Using psql**
```bash
psql $DATABASE_URL -f scripts/migrations/006-import-log.sql
```

**Option B: Using Neon Console**
1. Go to https://console.neon.tech
2. Select your project
3. Click "SQL Editor"
4. Copy/paste contents of `scripts/migrations/006-import-log.sql`
5. Click "Run"

**Expected output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
CREATE INDEX
```

### Step 2: Verify Tables

Run this query to verify:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('import_log', 'candidates');
```

Should return both tables.

**Status:** [ ] Complete

---

## ✅ Phase 2: Resend Setup (10 minutes)

### Step 1: Sign Up / Login to Resend

1. Go to https://resend.com
2. Sign up or login
3. Verify your email

**Status:** [ ] Complete

### Step 2: Get API Key

1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Name: "Wathefni Email Import"
4. Permission: "Full Access" (or "Sending + Inbound")
5. Copy the key (starts with `re_`)
6. Save it somewhere safe (you'll need it for Vercel)

**Status:** [ ] Complete

### Step 3: Add Domain

1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter: `import.wathefni.ai`
4. Follow DNS verification steps

**DNS Records to Add:**

Add these to your DNS provider (Namecheap, Cloudflare, etc.):

```
Type: MX
Name: import.wathefni.ai (or just "import" if base is wathefni.ai)
Value: inbound-smtp.resend.com
Priority: 10
TTL: 3600

Type: TXT
Name: import.wathefni.ai (or just "import")
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600
```

5. Wait for DNS propagation (5-30 minutes)
6. Click "Verify" in Resend dashboard

**Status:** [ ] DNS Records Added
**Status:** [ ] Domain Verified in Resend

### Step 4: Configure Inbound Route

1. Go to https://resend.com/inbound
2. Click "Create Route"
3. Configure:
   - **Match**: `*@import.wathefni.ai` (all emails)
   - **Forward to**: `https://cv-saas-1xu63cfj1-azizalmulla16-gmailcoms-projects.vercel.app/api/import/email`
   - **Description**: "Auto-import CVs for all orgs"
4. (Optional) Generate webhook secret for security
5. Click "Create"

**Status:** [ ] Complete

---

## ✅ Phase 3: Generate Internal Token (2 minutes)

### Generate Secure Token

Run this command in your terminal:

```bash
openssl rand -base64 32
```

**Example output:**
```
Xk7mP3nQ9rW2sT5vY8zB1cD4fG6hJ0kL9mN2pR5tV8xA1yC3eF6gH9jK0
```

Copy this token - you'll add it to Vercel as `INTERNAL_API_TOKEN`

**Status:** [ ] Token Generated & Saved

---

## ✅ Phase 4: Add Environment Variables to Vercel (5 minutes)

### Step 1: Open Vercel Settings

1. Go to https://vercel.com/azizalmulla16-gmailcoms-projects/cv-saas/settings/environment-variables
2. Or: Vercel Dashboard → Your Project → Settings → Environment Variables

### Step 2: Add New Variables

Add these **NEW** variables (one by one):

**1. RESEND_API_KEY**
- Name: `RESEND_API_KEY`
- Value: `re_xxxxx...` (from Step 2.2)
- Environment: ✅ Production ✅ Preview ✅ Development
- Click "Save"

**2. RESEND_FROM**
- Name: `RESEND_FROM`
- Value: `noreply@wathefni.ai` (or your verified domain)
- Environment: ✅ Production ✅ Preview ✅ Development
- Click "Save"

**3. INTERNAL_API_TOKEN**
- Name: `INTERNAL_API_TOKEN`
- Value: (paste the token from Phase 3)
- Environment: ✅ Production ✅ Preview ✅ Development
- Click "Save"

**4. NEXT_PUBLIC_APP_URL**
- Name: `NEXT_PUBLIC_APP_URL`
- Value: `https://cv-saas-1xu63cfj1-azizalmulla16-gmailcoms-projects.vercel.app`
- Environment: ✅ Production ✅ Preview ✅ Development
- Click "Save"

### Step 3: Verify Existing Variables

Make sure these are still set:
- ✅ `POSTGRES_URL`
- ✅ `DATABASE_URL`
- ✅ `OPENAI_API_KEY`
- ✅ `BLOB_READ_WRITE_TOKEN`

**Status:** [ ] All Variables Added

---

## ✅ Phase 5: Deploy (2 minutes)

### Deploy to Production

Run:
```bash
cd "/Users/azizalmulla/Desktop/cv saas"
vercel --prod
```

Wait for deployment to complete (~2-3 minutes)

**Status:** [ ] Deployed

---

## ✅ Phase 6: Test Email Import (5 minutes)

### Step 1: Send Test Email

From your personal email (Gmail, Outlook, etc.), send an email to:

**To:** `knet@import.wathefni.ai`

**Subject:** `Application for Software Developer`

**Body:**
```
Dear Hiring Team,

I am applying for the Software Developer position.

Name: Ahmad Test
Phone: +965 98765432
Field of Study: Computer Science
GPA: 3.7

Best regards,
Ahmad
```

**Attachment:** Attach any PDF (can be a sample CV or even a random PDF for testing)

### Step 2: Monitor Logs

Open terminal and run:
```bash
vercel logs --follow
```

Look for:
```
[EMAIL_IMPORT] Received email: { from: 'your-email@...', to: 'knet@import.wathefni.ai' }
[EMAIL_IMPORT] Parsed candidate data: { full_name: 'Ahmad Test', ... }
[EMAIL_IMPORT] PDF uploaded: https://...
[EMAIL_IMPORT] Created candidate: uuid-xxxx
[EMAIL_IMPORT] Success! Processed in XXXms
```

### Step 3: Check Dashboard

1. Go to: https://cv-saas-1xu63cfj1-azizalmulla16-gmailcoms-projects.vercel.app/knet/admin
2. Login with admin credentials
3. Click "📧 Import" tab
4. Should see:
   - Email Imports: 1
   - Recent activity showing your test import
5. Click "Students" tab
6. Should see "Ahmad Test" with CV

### Step 4: Check Confirmation Email

Check your inbox (the email you sent from) for confirmation:
```
Subject: Application Received - KNET

Dear Ahmad Test,

We have successfully received your CV and application materials...
```

**Status:** [ ] Test Email Sent
**Status:** [ ] Logs Show Success
**Status:** [ ] Candidate Visible in Dashboard
**Status:** [ ] Confirmation Email Received

---

## ✅ Phase 7: Setup Gmail/Outlook Forwarding (5 minutes)

### For Gmail (KNET's email)

1. Open Gmail for `applications@knet.com` (or whatever their HR email is)
2. Click ⚙️ Settings → "See all settings"
3. Go to "Forwarding and POP/IMAP" tab
4. Click "Add a forwarding address"
5. Enter: `knet@import.wathefni.ai`
6. Gmail will send confirmation email to that address
7. Check Resend logs or your system to confirm
8. Go back to Gmail settings
9. Click "Filters and Blocked Addresses"
10. Click "Create a new filter"
11. Configure:
    - **Has attachment** ✅
    - **Subject contains**: `application OR cv OR resume`
12. Click "Create filter"
13. Select: **Forward it to** → `knet@import.wathefni.ai`
14. Click "Create filter"

### For Outlook (Alternative)

1. Open Outlook → Settings → Mail → Rules
2. Add new rule
3. Condition: "Message has an attachment"
4. Action: "Forward to knet@import.wathefni.ai"
5. Save

**Status:** [ ] Forwarding Rule Created
**Status:** [ ] Tested with Real Application Email

---

## 🎉 Success Criteria

You're done when:

✅ Test email successfully imported  
✅ Candidate appears in dashboard  
✅ Confirmation email received  
✅ Parse status shows "COMPLETED"  
✅ CV is searchable via AI agent  
✅ Import tab shows activity  
✅ Gmail forwarding rule is active  

---

## 📊 What's Working Now

After completing this checklist:

1. **Manual uploads still work** (nothing broke)
2. **Email auto-import works** (new!)
3. **Candidates get instant confirmation** (professional!)
4. **HR gets real-time notifications** (efficient!)
5. **Zero manual data entry** (automated!)

---

## 🐛 Troubleshooting

### Issue: Email webhook not receiving requests

**Fix:**
1. Verify Resend inbound route URL is correct
2. Check DNS records: `dig MX import.wathefni.ai`
3. View Resend logs: https://resend.com/logs
4. Verify organization "knet" exists in your database:
   ```sql
   SELECT * FROM organizations WHERE slug = 'knet';
   ```

### Issue: 404 on webhook endpoint

**Fix:**
1. Redeploy: `vercel --prod`
2. Verify route exists: `/api/import/email/route.ts`
3. Check Vercel deployment logs

### Issue: Parsing fails

**Fix:**
1. Check `INTERNAL_API_TOKEN` is set correctly
2. Verify `OPENAI_API_KEY` is valid
3. Check Vercel logs for error details
4. Verify blob storage is working

### Issue: No confirmation email

**Fix:**
1. Check `RESEND_API_KEY` is correct
2. Verify `RESEND_FROM` domain is verified
3. Check Resend email logs: https://resend.com/emails
4. Verify candidate email is valid

---

## 📞 Support

If stuck, check:
1. Vercel logs: `vercel logs --follow`
2. Resend logs: https://resend.com/logs  
3. Database: Query `import_log` table
4. `EMAIL_IMPORT_SETUP.md` for detailed docs

---

## ⏭️ Next Steps (Phase 2)

After Phase 1 is working:
- [ ] Build CSV bulk upload
- [ ] Build PDF ZIP bulk upload
- [ ] Add public API for integrations
- [ ] Add WhatsApp integration

---

**Estimated Total Time: 30-40 minutes**

**Time Saved Per CV: 3-5 minutes**

**ROI: Pays for itself after ~10 CVs! 🚀**
