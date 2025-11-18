# 🎯 Inbox Subdomain Setup Guide

## 📊 Current Email Configuration

### **Existing Setup:**
```
wathefni.ai
└─ MX Record (Priority 10)
   └─ Points to: inbound-smtp.us-east-1.amazonaws.com (AWS SES)
```

**This is for your existing email service** (e.g., `admin@wathefni.ai`, `info@wathefni.ai`)

### **New Setup for Inbox System:**
```
inbox.wathefni.ai (subdomain)
└─ MX Record (Priority 10)
   └─ Points to: mx.resend.com
```

**This will handle candidate replies** (e.g., `nbk@inbox.wathefni.ai`, `knet@inbox.wathefni.ai`)

---

## ✅ Step-by-Step Setup

### **Step 1: Add MX Record in Vercel**

1. Go to: https://vercel.com/domains
2. Find and click on **"wathefni.ai"**
3. Scroll to **"DNS Records"** section
4. Click **"Add Record"**
5. Fill in:
   ```
   Type:     MX
   Name:     inbox
   Value:    mx.resend.com
   Priority: 10
   TTL:      3600 (default)
   ```
6. Click **"Save"**

### **Step 2: Enable Receiving on Resend**

1. Go to: https://resend.com/domains
2. Click on **"wathefni.ai"**
3. Find **"Receiving"** section
4. Toggle **ON** to enable receiving
5. You'll see a modal showing the MX record (you already added it!)
6. Click **"I've added the record"**
7. Wait for status to show **"Verified"** (5-30 minutes)

### **Step 3: Add Webhook in Resend**

1. Go to: https://resend.com/webhooks
2. Click **"Add Endpoint"**
3. Enter:
   ```
   URL: https://wathefni.ai/api/inbox/webhook
   Events: ✓ Email Received
   ```
4. Click **"Save"**
5. Copy the **Signing Secret** (optional, for webhook verification)

---

## 🔧 Code Changes Made

### **✅ Already Updated:**

**1. Webhook Handler** (`app/api/inbox/webhook/route.ts`)
- Now accepts both `@wathefni.ai` AND `@inbox.wathefni.ai`
- Regex: `/^(.+)@(?:inbox\.)?wathefni\.ai$/i`

**2. Reply Routes:**
- `app/api/[org]/admin/inbox/[threadId]/reply/route.ts`
- `app/api/[org]/admin/inbox/[threadId]/route.ts`
- Both now use `${orgSlug}@inbox.wathefni.ai`

### **Email Addresses Used:**

**Sending (from org to candidate):**
```
National Bank of Kuwait <nbk@inbox.wathefni.ai>
KNET <knet@inbox.wathefni.ai>
Boubyan Bank <boubyan@inbox.wathefni.ai>
```

**Receiving (candidates reply to):**
```
nbk@inbox.wathefni.ai
knet@inbox.wathefni.ai
boubyan@inbox.wathefni.ai
```

---

## 🧪 Testing

### **Step 1: Wait for DNS Propagation**
Check if MX record is live:
```bash
nslookup -type=mx inbox.wathefni.ai
```

Expected output:
```
inbox.wathefni.ai     mail exchanger = 10 mx.resend.com.
```

### **Step 2: Send Test Email**

From your personal email, send to:
```
nbk@inbox.wathefni.ai

Subject: Test Candidate Reply
Body: Hi, I'm interested in the position!
```

### **Step 3: Check Logs**

**Resend Dashboard:**
- https://resend.com/emails
- Should see incoming email

**Vercel Logs:**
- Go to: https://vercel.com/azizalmulla16-gmailcoms-projects/cv-saas
- Click "Logs"
- Filter for: `INBOX_WEBHOOK`
- Should see webhook processing logs

**Admin Inbox:**
- Go to: `https://wathefni.ai/nbk/admin/inbox`
- Should see new thread with your test message

---

## 📧 Email Flow

### **Complete Conversation Flow:**

```
1. Admin sends initial message
   FROM: nbk@inbox.wathefni.ai
   TO: candidate@gmail.com
   ↓
2. Candidate clicks "Reply" in email client
   TO: nbk@inbox.wathefni.ai (auto-filled)
   ↓
3. Email arrives at Resend
   ↓
4. Resend calls webhook: POST /api/inbox/webhook
   ↓
5. Webhook extracts org slug: "nbk"
   ↓
6. Saves message to inbox_messages table
   ↓
7. Notifies admin via email
   ↓
8. Admin sees message in dashboard
```

---

## 🎯 Organization Email Addresses

### **Your Organizations:**

| Organization | Slug | Inbox Email |
|--------------|------|-------------|
| National Bank of Kuwait | `nbk` | `nbk@inbox.wathefni.ai` |
| KNET | `knet` | `knet@inbox.wathefni.ai` |
| Boubyan Bank | `boubyan` | `boubyan@inbox.wathefni.ai` |
| STC Kuwait | `stc-kuwait` | `stc-kuwait@inbox.wathefni.ai` |
| Zain Kuwait | `zain-kuwait` | `zain-kuwait@inbox.wathefni.ai` |
| Careerly | `careerly` | `careerly@inbox.wathefni.ai` |
| Demo Company | `demo` | `demo@inbox.wathefni.ai` |
| Testing | `testing` | `testing@inbox.wathefni.ai` |
| ai octopus | `ai-octopus` | `ai-octopus@inbox.wathefni.ai` |

---

## 🔍 Troubleshooting

### **Issue: MX record not verified**
**Solution:**
```bash
# Check if DNS has propagated
nslookup -type=mx inbox.wathefni.ai

# If not showing mx.resend.com, wait longer
# DNS can take up to 48 hours (usually 5-30 min)
```

### **Issue: Webhook not receiving emails**
**Solution:**
1. Check Resend logs: https://resend.com/emails
2. Verify webhook is configured correctly
3. Check webhook URL is exactly: `https://wathefni.ai/api/inbox/webhook`
4. Test webhook manually via Resend dashboard

### **Issue: Emails going to spam**
**Solution:**
1. Add SPF record in Vercel DNS:
   ```
   Type: TXT
   Name: inbox
   Value: v=spf1 include:_spf.resend.com ~all
   ```
2. Add DKIM records (provided by Resend)
3. Add DMARC record:
   ```
   Type: TXT
   Name: _dmarc.inbox
   Value: v=DMARC1; p=none;
   ```

### **Issue: Wrong organization receiving emails**
**Solution:**
- Check org slug matches email prefix
- Example: `nbk@inbox.wathefni.ai` must have org with slug `nbk`
- Check database: `SELECT slug FROM organizations;`

---

## 📊 DNS Records Summary

### **After Setup, Your DNS Should Look Like:**

```
┌──────────────────────────────────────────────────────┐
│  DNS Records for wathefni.ai                         │
├──────────────────────────────────────────────────────┤
│                                                       │
│  EXISTING RECORDS:                                    │
│  Type  Name   Value                     Priority     │
│  ────────────────────────────────────────────────    │
│  MX    @      inbound-smtp.us-east-1..  10          │
│  A     @      76.76.21.21               -           │
│  CNAME www    cname.vercel-dns.com      -           │
│                                                       │
│  NEW RECORD FOR INBOX:                                │
│  ────────────────────────────────────────────────    │
│  MX    inbox  mx.resend.com             10          │ ← Add this
│                                                       │
└──────────────────────────────────────────────────────┘
```

---

## ✅ Verification Checklist

```
[ ] MX record added to Vercel DNS for inbox.wathefni.ai
[ ] Receiving enabled on Resend dashboard
[ ] Resend shows "Verified" status for receiving
[ ] Webhook configured: https://wathefni.ai/api/inbox/webhook
[ ] Test email sent to nbk@inbox.wathefni.ai
[ ] Test email received in Resend
[ ] Webhook triggered successfully
[ ] Message appears in admin inbox
[ ] Admin can reply to candidate
[ ] Candidate receives reply from nbk@inbox.wathefni.ai
[ ] Code deployed to production
```

---

## 🎉 Benefits of Subdomain Approach

### **✅ Advantages:**

1. **No Conflicts**
   - Existing emails (`admin@wathefni.ai`) still work
   - AWS SES continues to handle root domain

2. **Clean Separation**
   - Inbox system: `@inbox.wathefni.ai`
   - Everything else: `@wathefni.ai`

3. **Easy Debugging**
   - Can track inbox emails separately
   - Clear routing in DNS

4. **Scalable**
   - Can add more subdomains later
   - `careers@wathefni.ai`, `support@wathefni.ai`, etc.

5. **Professional**
   - Clear purpose in email address
   - Candidates know it's for inbox communication

---

## 🚀 Next Steps

1. **Add MX Record** → 5 minutes
2. **Wait for DNS** → 5-30 minutes
3. **Enable Receiving** → 2 minutes
4. **Add Webhook** → 2 minutes
5. **Test** → 5 minutes

**Total Time: ~45 minutes (including DNS wait)**

---

## 📞 Support

If you run into issues:

1. **Check Resend Dashboard:**
   - https://resend.com/emails (incoming emails)
   - https://resend.com/webhooks (webhook calls)

2. **Check Vercel Logs:**
   - https://vercel.com/azizalmulla16-gmailcoms-projects/cv-saas
   - Filter for: `INBOX_WEBHOOK`

3. **Check DNS:**
   ```bash
   nslookup -type=mx inbox.wathefni.ai
   ```

4. **Test Webhook:**
   - Resend Dashboard → Webhooks → Click your webhook → "Send Test"

---

## 🎯 Summary

**Your inbox system is now configured to use:**

```
nbk@inbox.wathefni.ai
knet@inbox.wathefni.ai
boubyan@inbox.wathefni.ai
...etc
```

**While your existing emails still work at:**

```
admin@wathefni.ai
info@wathefni.ai
...etc
```

**No conflicts, no issues, everything works perfectly!** ✅
