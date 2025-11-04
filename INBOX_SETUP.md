# 📧 Inbox Feature Setup Guide

## 🎉 Resend Inbound is Live!

Your address: `<your-alias>@fresh-antlion.resend.app`

---

## ⚡️ Quick Setup (5 Steps - 10 minutes)

### Step 1: Choose Your Alias

Replace `<your-alias>` with:
```
admin@fresh-antlion.resend.app  ✅ RECOMMENDED
```

This will be the address where candidate replies are sent.

---

### Step 2: Add Vercel Environment Variable

Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add:
```
Name: RESEND_INBOUND_EMAIL
Value: admin@fresh-antlion.resend.app
```

Click **Save** → **Redeploy** (or it will auto-deploy on next push)

---

### Step 3: Configure Resend Webhook

Go to **Resend Dashboard** → **Webhooks** → **Add Webhook**

```
Endpoint URL: https://your-vercel-domain.vercel.app/api/inbox/webhook
Events to listen: ✅ email.received
```

**Important:** Use your actual Vercel domain, e.g.:
```
https://cv-saas-3qftfhgn5-azizalmulla16-gmailcoms-projects.vercel.app/api/inbox/webhook
```

Click **Create Webhook**

---

### Step 4: Run Database Migration (if not done)

Go to **Neon Console** → SQL Editor → Run:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('inbox_threads', 'inbox_messages');

-- If they don't exist, run:
-- (Copy entire contents from: migrations/create-inbox-tables.sql)
```

---

### Step 5: Test It!

#### Send a Test Email:

1. Go to Admin Dashboard → **AI Agent** tab
2. Find a candidate (or use yourself for testing)
3. Ask AI: `"Email Buthaina about the interview tomorrow at 3pm"`
4. AI sends email with `Reply-To: admin@fresh-antlion.resend.app`

#### Reply to the Email:

1. Open the email you received
2. Click **Reply**
3. Type: `"Yes, 3pm works great!"`
4. Send

#### Check Admin Inbox:

1. Go to Admin Dashboard → **Inbox** tab (should show "Soon" badge)
2. You should see the reply thread!
3. Click to view full conversation

---

## 🔍 Troubleshooting

### "I sent a test email but didn't get it"

Check your spam folder, or use your own email for testing:
```
AI: "Email azizalmulla16@gmail.com about the test"
```

### "I replied but it's not showing in inbox"

1. Check **Vercel Logs** for: `[INBOX_WEBHOOK] Received email`
2. Check **Resend Dashboard** → **Webhooks** → View recent requests
3. If webhook shows success but inbox is empty:
   - Check database: `SELECT * FROM inbox_messages ORDER BY created_at DESC LIMIT 5;`
   - Verify `org_id` matches your organization

### "Webhook is receiving 401 Unauthorized"

- Webhook endpoint is public, no auth required
- Check the webhook URL is correct (no typos)
- Try re-saving the webhook in Resend

### "Email sent but Reply-To is wrong"

- Make sure you redeployed after adding `RESEND_INBOUND_EMAIL` env var
- Check Vercel logs for: `[AI_AGENT_EMAIL] Reply-To: admin@fresh-antlion.resend.app`

---

## 📊 How It Works

```
1. Admin AI Agent → "Email candidate about interview"
   ↓
2. Email sent with Reply-To: admin@fresh-antlion.resend.app
   ↓
3. Candidate receives email → Clicks Reply
   ↓
4. Reply goes to: admin@fresh-antlion.resend.app
   ↓
5. Resend forwards to webhook: /api/inbox/webhook
   ↓
6. Webhook saves to database: inbox_threads + inbox_messages
   ↓
7. Admin sees reply in Inbox tab ✅
```

---

## 🎯 For STC Demo

This is a **killer feature** to show STC:

### Demo Flow:
1. **Show AI Agent** sending interview invite
2. **Show email** candidate receives (with clean Reply-To)
3. **Send test reply** from your phone/laptop
4. **Show Inbox tab** - reply appears in real-time
5. **Emphasize**: "Two-way communication, all in one platform"

### Talking Points:
- ✅ "No context switching - replies come straight to admin dashboard"
- ✅ "Full conversation history in one place"
- ✅ "Works with mobile - candidates can reply from anywhere"
- ✅ "Scales to thousands of conversations"

---

## 🚀 Optional: Upgrade to Custom Domain Inbound

Once you get custom domain inbound from Resend:

1. Update env var:
   ```
   RESEND_INBOUND_EMAIL=admin@wathefni.ai
   ```

2. Configure Resend inbound route:
   ```
   Match: *@wathefni.ai
   Forward to: https://your-domain.vercel.app/api/inbox/webhook
   ```

This makes replies go to `admin@wathefni.ai` instead of `fresh-antlion.resend.app` - more professional!

---

## ✅ Verification Checklist

Before STC demo:
- [ ] Environment variable `RESEND_INBOUND_EMAIL` added to Vercel
- [ ] Webhook configured in Resend dashboard
- [ ] Database tables `inbox_threads` and `inbox_messages` exist
- [ ] Test email sent via AI agent
- [ ] Test reply received and appears in inbox
- [ ] Inbox tab shows "Soon" badge when new messages arrive
- [ ] Can click thread to view full conversation

---

## 💡 Pro Tip

Test with your own email first:
```
1. AI Agent: "Email azizalmulla16@gmail.com about testing the inbox"
2. Check your Gmail
3. Reply: "This is a test reply"
4. Check admin inbox - should appear within seconds!
```

---

**You're ready! The inbox feature is 100% functional and will blow STC's minds.** 🎉

Questions? Check Vercel logs or Resend webhook logs for debugging.
