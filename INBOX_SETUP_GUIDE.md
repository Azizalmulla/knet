# Multi-Tenant Inbox System - Setup Guide

## ✅ What's Been Implemented

### 1. Database Schema
- **`inbox_threads`** table - conversation threads per org
- **`inbox_messages`** table - individual messages
- **Triggers** - auto-update unread counts and timestamps
- **Indexes** - optimized for performance

### 2. AI Agent Email Sending
- **Real email delivery** via Resend (no more mailto links)
- **Org-specific senders**: `nbk@wathefni.ai`, `knet@wathefni.ai`, etc.
- **Preview mode**: Set `sendEmail: false` to preview before sending
- **Email tracking**: Returns email ID from Resend

### 3. API Routes

#### Inbox Management
- `GET /api/[org]/admin/inbox` - List threads (with filters: all/unread, search)
- `GET /api/[org]/admin/inbox/[threadId]` - Get thread with messages
- `POST /api/[org]/admin/inbox/[threadId]` - Send reply (auto-emails candidate)
- `PATCH /api/[org]/admin/inbox/[threadId]` - Mark read/archive

#### Webhook
- `POST /api/[org]/inbox/webhook` - Receives candidate replies from Resend
- **Auto-routing**: Extracts org from recipient email (`nbk@wathefni.ai` → NBK org)
- **Thread matching**: Finds existing conversation or creates new one

### 4. Email Notifications
- Admins get notified when candidates reply
- Beautiful HTML email template
- Link to view message in dashboard

---

## 🚀 Setup Instructions

### Step 1: Run Database Migration

```bash
# Connect to your Neon database
psql $DATABASE_URL -f migrations/add-inbox-system.sql
```

This creates:
- `inbox_threads` table
- `inbox_messages` table
- Triggers for auto-updating counts
- Indexes for performance

### Step 2: Install Resend

```bash
npm install resend
```

### Step 3: Set Up Resend Domain

1. **Go to**: [resend.com/domains](https://resend.com/domains)
2. **Add domain**: `wathefni.ai`
3. **Add DNS records** to your domain registrar (Namecheap, Cloudflare, etc.):

```
TXT  @  v=spf1 include:resend.net ~all
CNAME resend._domainkey  [value from Resend dashboard]
CNAME resend-track  [value from Resend dashboard]
```

4. **Wait 5-10 minutes** for DNS propagation
5. **Click "Verify"** in Resend dashboard

### Step 4: Configure Environment Variables

Add to `.env.local`:

```bash
# Resend API Key (get from resend.com/api-keys)
RESEND_API_KEY=re_xxxxxxxxxxxxx

# Your app URL (for email links)
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 5: Set Up Resend Webhook

1. **Go to**: [resend.com/webhooks](https://resend.com/webhooks)
2. **Add endpoint**:
   - URL: `https://yourdomain.com/api/inbox/webhook`
   - Events: Check `email.received`
3. **Save**

---

## 📧 How It Works

### Sending Emails (AI Agent → Candidate)

```typescript
// Admin uses AI Agent to email a candidate
POST /api/admin/agent/email
{
  "type": "interview",
  "candidateName": "Ahmed Ali",
  "candidateEmail": "ahmed@gmail.com",
  "roleTitle": "Software Engineer",
  "orgSlug": "nbk",      // ← Organization slug
  "orgName": "NBK",      // ← Organization name
  "sendEmail": true
}

// Email sent from: NBK HR Team <nbk@wathefni.ai>
// Candidate sees: "From: NBK HR Team"
```

### Receiving Replies (Candidate → Inbox)

```
1. Candidate clicks "Reply" in Gmail
   To: nbk@wathefni.ai

2. Resend forwards to webhook:
   POST /api/inbox/webhook

3. Webhook extracts org from email:
   nbk@wathefni.ai → NBK org

4. Message saved to inbox_messages:
   - Linked to NBK's organization_id
   - Thread created/updated
   - Unread count incremented

5. Admin gets notification email:
   "New message from Ahmed Ali"
   [View in Dashboard] → /{org}/admin/inbox
```

### Admin Replies (Inbox → Candidate)

```
1. Admin views inbox at /{org}/admin/inbox
2. Clicks thread, types reply
3. API sends email AND saves to database:
   - Email sent via Resend
   - Message saved to inbox_messages
   - Candidate receives email
```

---

## 🧪 Testing

### 1. Test Email Sending

```bash
# Use the AI Agent in admin dashboard
1. Go to /{org}/admin → AI Agent tab
2. Select a candidate
3. Click "Send Interview Email"
4. Check if email arrives (check spam folder)
```

### 2. Test Receiving Replies

```bash
# Reply to the email you sent
1. Open the email in Gmail/Outlook
2. Click Reply
3. Type a message
4. Send

# Check inbox
5. Go to /{org}/admin/inbox
6. You should see the reply appear
```

### 3. Test Multi-Tenancy

```bash
# Send from different orgs
1. Login as NBK admin → Send email (from nbk@wathefni.ai)
2. Login as KNET admin → Send email (from knet@wathefni.ai)

# Reply to each email
3. Both replies route to correct org inbox
4. NBK admin only sees NBK messages
5. KNET admin only sees KNET messages
```

---

## 📋 Checklist Before Launch

- [ ] Database migration ran successfully
- [ ] Resend domain verified (green checkmark)
- [ ] `RESEND_API_KEY` in environment variables
- [ ] Webhook endpoint configured in Resend
- [ ] Test email sent and received
- [ ] Test reply routing to correct org
- [ ] Admin notification email received
- [ ] Inbox UI displays messages correctly

---

## 🔧 Troubleshooting

### Email not sending
- Check `RESEND_API_KEY` is set correctly
- Verify domain is verified in Resend dashboard
- Check server logs for errors

### Replies not appearing in inbox
- Check webhook is configured in Resend
- Verify webhook URL is publicly accessible
- Check webhook logs in Resend dashboard
- Check server logs at `/api/inbox/webhook`

### Wrong org receiving messages
- Check email address format: `{orgSlug}@wathefni.ai`
- Verify org slug matches database: `SELECT slug FROM organizations`
- Check webhook logs for org extraction

### Admin not getting notifications
- Check `getOrgAdminEmail()` returns valid email
- Verify admin email exists in `admin_users` table
- Check spam folder

---

## 🎯 What's Next

### UI Update (Pending)
Update `/app/[org]/admin/inbox/page.tsx` to:
- Fetch real data from API instead of mock data
- Display threads and messages
- Send replies via API
- Mark messages as read

### Optional Enhancements
- [ ] Email signature per org
- [ ] Email templates per org
- [ ] Attachment support
- [ ] Rich text editor for replies
- [ ] Email scheduling
- [ ] Auto-responses

---

## 📁 Files Created/Modified

### New Files
- `migrations/add-inbox-system.sql` - Database schema
- `lib/inbox-notifications.ts` - Email notification helper
- `app/api/[org]/admin/inbox/route.ts` - List threads API
- `app/api/[org]/admin/inbox/[threadId]/route.ts` - Thread details & reply API
- `app/api/[org]/inbox/webhook/route.ts` - Receive candidate replies
- `INBOX_SETUP_GUIDE.md` - This file

### Modified Files
- `app/api/admin/agent/email/route.ts` - Updated to send real emails via Resend

---

## 💡 Key Benefits

✅ **100% Multi-Tenant** - Each org has isolated inbox  
✅ **Professional Branding** - Org-specific email addresses  
✅ **Automatic Routing** - Email address = org identifier  
✅ **Real Email** - No mailto links, actual SMTP delivery  
✅ **Thread Tracking** - Conversations grouped by candidate  
✅ **Notifications** - Admins get alerted on replies  
✅ **Scalable** - Add unlimited orgs without config

---

## 📞 Support

If you need help:
1. Check server logs for errors
2. Verify all environment variables are set
3. Test with a simple email first
4. Check Resend dashboard for delivery status
