# Resend Inbound Setup - Visual Guide

## 🎯 What You Need to Do in Resend Dashboard

### You're Currently Here:
```
┌─────────────────────────────────────┐
│  Inbound address                    │
│                                     │
│  This is a predefined address you  │
│  can use to start receiving emails │
│                                     │
│  inbound@fresh-antlion.resend.app  │
│                                     │
│  [Copy] ⌘ + C    [Cancel] Esc     │
└─────────────────────────────────────┘
```

---

## Step-by-Step Instructions

### Step 1: Copy the Email Address
Click **"Copy"** button or manually copy:
```
inbound@fresh-antlion.resend.app
```

### Step 2: Look for "Add Destination" or "Webhook" Field
The dialog should have a field to enter where emails should be sent.

**Enter this webhook URL:**
```
https://watheefni.ai/api/inbound/cv
```

### Step 3: Save/Create
Click the save or create button.

---

## 🤔 If You Don't See Webhook Field

### Option A: Click "Copy" First
1. Click **"Copy"** button
2. Dialog might close
3. Look for **"Inbound"** section in sidebar
4. You should see the email address listed
5. Click on it to configure webhook

### Option B: Close and Navigate
1. Click **"Cancel"**
2. Go to **"Inbound"** in sidebar
3. Look for **"Create Route"** or **"Add Route"** button
4. Fill in:
   - Email: `inbound@fresh-antlion.resend.app`
   - Webhook: `https://watheefni.ai/api/inbound/cv`

---

## 📋 What the Final Setup Should Look Like

```
┌─────────────────────────────────────────┐
│  Inbound Routes                         │
├─────────────────────────────────────────┤
│  Email Address                          │
│  inbound@fresh-antlion.resend.app      │
│                                         │
│  Webhook URL                            │
│  https://watheefni.ai/api/inbound/cv   │
│                                         │
│  Status: Active ✓                       │
│                                         │
│  [Edit]  [Delete]  [Test]              │
└─────────────────────────────────────────┘
```

---

## ✅ Verification

After setup, you should be able to:

1. **See the route listed** in Inbound section
2. **Status shows "Active"**
3. **Test button available** (optional - sends test email)

---

## 🚀 After Resend Setup

### 1. Deploy Your Code
```bash
cd /Users/azizalmulla/Desktop/cv\ saas
vercel --prod
```

### 2. Wait for Deployment
```
✅ Production: https://watheefni.ai
```

### 3. Send Test Email
```
To: inbound@fresh-antlion.resend.app
Subject: Test CV Submission - John Doe
Attachment: test.pdf
```

### 4. Check Results
- ✅ Confirmation email received
- ✅ Candidate in admin dashboard
- ✅ Server logs show success

---

## 🎯 Quick Reference

**Email for CV submissions:**
```
inbound@fresh-antlion.resend.app
```

**Webhook URL:**
```
https://watheefni.ai/api/inbound/cv
```

**Deploy command:**
```bash
vercel --prod
```

**Test email format:**
```
To: inbound@fresh-antlion.resend.app
Subject: Application - [Your Name]
Attachment: cv.pdf
```

---

## 💡 Tips

### Tip 1: Use Resend's Test Feature
If available, click **"Test"** button in Resend to send a test webhook. This verifies the webhook URL is correct.

### Tip 2: Check Webhook Logs
Resend shows webhook delivery logs. You can see:
- When webhook was called
- Response status (200 = success)
- Response time
- Any errors

### Tip 3: Start with Test Email
Before promoting, send yourself a test email to verify everything works.

---

## 🔍 Common Issues

### Issue: Can't find webhook field
**Solution:** Look for "Add destination", "Forward to", or "Webhook URL" field. Different Resend UI versions use different labels.

### Issue: Webhook URL rejected
**Solution:** Make sure URL starts with `https://` and is a valid domain (not localhost).

### Issue: Route created but not active
**Solution:** Check if there's an "Activate" or "Enable" button. Click it.

---

## 📞 Need Help?

**If stuck on Resend setup:**
1. Take a screenshot of what you see
2. Share it with me
3. I'll guide you through exact steps

**If webhook isn't working:**
1. Deploy code first: `vercel --prod`
2. Verify URL is accessible
3. Check Resend webhook logs
4. Check Vercel function logs

---

## ✅ Success Checklist

- [ ] Inbound route created in Resend
- [ ] Email: `inbound@fresh-antlion.resend.app`
- [ ] Webhook: `https://watheefni.ai/api/inbound/cv`
- [ ] Status: Active
- [ ] Code deployed to production
- [ ] Test email sent
- [ ] Confirmation received
- [ ] Ready to use!

---

**You're almost there! Just set up the webhook in Resend and deploy.** 🚀
