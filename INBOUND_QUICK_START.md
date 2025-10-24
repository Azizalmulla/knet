# Inbound Email CV Submission - Quick Start

## ✅ Using Test Email Address

**Email address for CV submissions:**
```
inbound@fresh-antlion.resend.app
```

This is a Resend test address. Later you can switch to `submit@watheefni.ai` when custom domain is enabled.

---

## 🚀 Setup Steps (Do This Now)

### Step 1: Create Inbound Route in Resend

1. **Go to Resend dashboard** → https://resend.com/emails?mode=receiving
2. **You should see the dialog with:**
   ```
   Inbound address: inbound@fresh-antlion.resend.app
   ```
3. **Click "Copy"** to copy the email address
4. **Look for "Add destination" or "Webhook URL" field**
5. **Enter:**
   ```
   https://watheefni.ai/api/inbound/cv
   ```
6. **Click "Save" or "Create"**

---

### Step 2: Deploy the Code

```bash
vercel --prod
```

Wait for deployment to finish (~1-2 minutes).

---

### Step 3: Test It!

**Send a test email from your personal email:**

```
To: inbound@fresh-antlion.resend.app
Subject: Test Application - Your Name
Body: This is a test CV submission
Attachment: any_pdf_file.pdf (attach any PDF)
```

**What should happen:**
1. ✅ You receive confirmation email within seconds
2. ✅ Candidate appears in all org admin dashboards
3. ✅ PDF is stored in Vercel Blob
4. ✅ Server logs show success

---

## 📧 Confirmation Email You'll Receive

```
Subject: CV Received Successfully ✓

Hi Your Name,

We've successfully received your CV and added you to our candidate database.

Your profile has been submitted to:
- KNET
- Boubyan Bank
- National Bank of Kuwait
- Careerly
- (all your public organizations)

Our AI will analyze your CV and match you with relevant opportunities.

Best regards,
Watheefni AI Team
```

---

## 🔍 Check Server Logs

After sending test email, check your Vercel logs:

```
[INBOUND CV] Received email from: your-email@gmail.com
[INBOUND CV] Subject: Test Application - Your Name
[INBOUND CV] Attachments: 1
[INBOUND CV] Uploading PDF to Vercel Blob...
[INBOUND CV] PDF uploaded: https://blob.vercel-storage.com/...
[INBOUND CV] Added to KNET (knet): abc-123
[INBOUND CV] Added to Boubyan Bank (boubyan): def-456
[INBOUND CV] Success email sent to: your-email@gmail.com
[INBOUND CV] Success! Added to X organizations
```

---

## 👀 Check Admin Dashboard

1. **Go to any org admin dashboard:**
   ```
   https://watheefni.ai/knet/admin
   ```

2. **You should see new candidate:**
   ```
   Name: Your Name
   Email: your-email@gmail.com
   Source: Email Submission
   Status: Pending
   CV: [View PDF]
   ```

---

## ⚠️ Troubleshooting

### Issue: No confirmation email received

**Check:**
1. Spam folder
2. Server logs for errors
3. `RESEND_API_KEY` is set in Vercel environment
4. Resend dashboard for delivery status

### Issue: Webhook not called

**Check:**
1. Webhook URL is correct: `https://watheefni.ai/api/inbound/cv`
2. Code is deployed (not localhost)
3. Resend inbound route is active
4. Check Resend webhook logs

### Issue: "No PDF attachment found" error

**Make sure:**
- You attached a file
- File is PDF format (.pdf)
- File is under 10MB

### Issue: Candidate not in database

**Check:**
1. Organizations are public (`is_public = true`)
2. Database connection is working
3. Server logs for database errors

---

## 🎯 What Happens Behind the Scenes

1. **Student sends email** → `inbound@fresh-antlion.resend.app`
2. **Resend receives it** → Forwards to your webhook
3. **Your API receives webhook** → `POST /api/inbound/cv`
4. **API extracts PDF** → Uploads to Vercel Blob
5. **API queries database** → Gets all public organizations
6. **API adds candidate** → One record per organization
7. **API sends confirmation** → Email to student
8. **Done!** → Candidate visible in all org dashboards

---

## 📊 Database Records Created

For each public organization, a record is created:

```sql
INSERT INTO candidates (
  organization_id,    -- KNET's ID
  full_name,          -- "Your Name"
  email,              -- "your-email@gmail.com"
  cv_blob_key,        -- "https://blob.vercel-storage.com/..."
  cv_type,            -- "uploaded"
  parse_status,       -- "pending"
  created_at          -- Current timestamp
)
```

If you have 5 public orgs, 5 records are created (one per org).

---

## 🔄 Switching to Custom Email Later

When Resend enables custom domain inbound:

1. **Create new inbound route:**
   ```
   Email: submit@watheefni.ai
   Webhook: https://watheefni.ai/api/inbound/cv
   ```

2. **No code changes needed!** The webhook works the same.

3. **Update marketing materials:**
   ```
   Old: inbound@fresh-antlion.resend.app
   New: submit@watheefni.ai
   ```

4. **Keep old route active** for a while (in case people use old email)

---

## 📢 How to Promote

### On Your Website:
```html
<h2>Submit Your CV</h2>
<p>Email your CV to: <strong>inbound@fresh-antlion.resend.app</strong></p>
<p>Or use our web form: <a href="/start">Submit Online</a></p>
```

### Social Media:
```
🎯 New! Submit your CV via email

Send your CV (PDF) to:
inbound@fresh-antlion.resend.app

✅ Instant confirmation
✅ Automatic matching
✅ Multiple organizations

#JobSearch #Kuwait
```

### Email Signature:
```
📧 Submit CVs: inbound@fresh-antlion.resend.app
🌐 Website: watheefni.ai
```

---

## ✅ Checklist

- [ ] Inbound route created in Resend
- [ ] Webhook URL set: `https://watheefni.ai/api/inbound/cv`
- [ ] Code deployed: `vercel --prod`
- [ ] Test email sent
- [ ] Confirmation email received
- [ ] Candidate appears in admin dashboard
- [ ] Server logs show success

---

## 🚀 Ready to Go!

**Current email:** `inbound@fresh-antlion.resend.app`  
**Webhook:** `https://watheefni.ai/api/inbound/cv`  
**Status:** Ready to test after deployment

**Next steps:**
1. Create inbound route in Resend
2. Deploy: `vercel --prod`
3. Send test email
4. Verify it works
5. Start promoting!

---

## 📞 Need Help?

**If webhook doesn't work:**
- Check Vercel deployment logs
- Check Resend webhook logs
- Verify URL is correct
- Test with Resend's "Send Test" button

**If emails aren't received:**
- Check spam folder
- Verify `RESEND_API_KEY` is set
- Check Resend email logs
- Look for errors in server logs

**If candidates don't appear:**
- Check database for records
- Verify organizations are public
- Check server logs for errors
- Refresh admin dashboard

Good luck! 🎉
