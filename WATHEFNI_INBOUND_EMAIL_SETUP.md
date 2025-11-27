# 📧 Wathefni.ai Inbound Email Setup

## Goal
Enable candidates to reply to emails sent from Wathefni AI, and have those replies appear in the admin inbox.

**Flow:**
```
Admin sends email via AI Agent → Candidate receives email → Candidate replies
                                                                    ↓
                                                   reply@wathefni.ai receives it
                                                                    ↓
                                                   Resend forwards to webhook
                                                                    ↓
                                                   Appears in Admin Inbox ✅
```

---

## Step 1: Configure DNS for Inbound Email

Add these **MX records** to your wathefni.ai domain DNS:

| Type | Name | Priority | Value |
|------|------|----------|-------|
| MX | @ | 10 | `inbound-smtp.resend.com` |
| MX | @ | 20 | `inbound-smtp2.resend.com` |

**Or for a subdomain (safer option):**

| Type | Name | Priority | Value |
|------|------|----------|-------|
| MX | inbox | 10 | `inbound-smtp.resend.com` |
| MX | inbox | 20 | `inbound-smtp2.resend.com` |

This would use `inbox.wathefni.ai` for receiving (e.g., `knet@inbox.wathefni.ai`)

**DNS Provider:** Go to your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.)

---

## Step 2: Configure Resend Inbound

1. Go to **Resend Dashboard** → **Inbound**
2. Click **Add Domain**
3. Enter: `wathefni.ai` (or `inbox.wathefni.ai` if using subdomain)
4. Resend will verify the MX records
5. **Configure Webhook URL:**
   ```
   https://wathefni.ai/api/inbox/webhook
   ```
   Or your Vercel domain:
   ```
   https://cv-saas-xxx.vercel.app/api/inbox/webhook
   ```

6. **Select Events:** ✅ email.received
7. Save

---

## Step 3: Verify Webhook Endpoint

Your webhook is ready at `/api/inbox/webhook`. It already handles:
- ✅ Parsing incoming emails
- ✅ Extracting org from recipient (e.g., `knet@wathefni.ai` → org "knet")
- ✅ Creating/updating inbox threads
- ✅ Saving messages
- ✅ Notifying admins

---

## Step 4: Update Email Reply-To Headers

Make sure all outgoing emails have the correct Reply-To address.

**File:** `app/api/admin/agent/email/route.ts`

The Reply-To should be: `{orgSlug}@wathefni.ai`

---

## Step 5: Test It!

1. **Send a test email** from Admin AI Agent:
   ```
   "Email azizalmulla16@gmail.com about testing the reply feature"
   ```

2. **Check the email** - Reply-To should show `knet@wathefni.ai`

3. **Reply to the email**

4. **Check Admin Inbox** - Reply should appear!

5. **Check Vercel Logs** for `[INBOX_WEBHOOK]` entries

---

## Troubleshooting

### MX Records Not Propagating
- Wait 1-24 hours for DNS propagation
- Use https://mxtoolbox.com/SuperTool.aspx to check
- Enter: `wathefni.ai` or `inbox.wathefni.ai`

### Webhook Not Receiving
- Check Resend Dashboard → Webhooks → View logs
- Ensure webhook URL is publicly accessible (not localhost)
- Check Vercel deployment is live

### Emails Going to Wrong Org
- Check the recipient address format matches `{orgSlug}@wathefni.ai`
- Ensure org slug exists in database

---

## Alternative: Use Resend's Default Domain (Faster)

If you don't want to set up custom domain MX records yet, use Resend's provided domain:

1. In Resend Dashboard → Inbound, you'll see a default domain like:
   `fresh-antlion.resend.app` or similar

2. Update your Reply-To to use this domain:
   - Change: `knet@wathefni.ai` 
   - To: `knet@fresh-antlion.resend.app`

3. Set up webhook in Resend to point to your endpoint

This works immediately without DNS changes!

---

## Verification Checklist

- [ ] MX records added to wathefni.ai (or inbox.wathefni.ai)
- [ ] Resend Inbound domain verified
- [ ] Webhook URL configured in Resend
- [ ] `RESEND_INBOUND_DOMAIN` env var set in Vercel (if using)
- [ ] Test email sent with correct Reply-To
- [ ] Reply received in admin inbox
- [ ] Vercel logs show `[INBOX_WEBHOOK]` entries

---

## Environment Variables

Add to Vercel:

```
RESEND_INBOUND_DOMAIN=wathefni.ai
```
(or `inbox.wathefni.ai` if using subdomain)

This is used to generate Reply-To addresses.
