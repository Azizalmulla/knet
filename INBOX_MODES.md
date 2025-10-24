# Email Inbox Modes - Configuration Guide

## Overview

Your system now supports **3 different inbox modes** for handling candidate email replies. Each organization can choose their preferred mode.

---

## The 3 Modes

### 1. **`inbox_only`** (Centralized Inbox)
**Reply-To:** `{orgslug}@wathefni.ai` (e.g., `knet@wathefni.ai`)

**Flow:**
- AI Agent sends email
- Candidate replies to `knet@wathefni.ai`
- Resend forwards to `/api/inbox/webhook`
- Reply appears in Inbox tab
- Admin must reply from Inbox UI

**✅ Best For:**
- Large teams with shared inbox
- Call centers or support teams
- When you want ALL communication tracked
- Professional HR departments

**✅ Pros:**
- Everything centralized
- Multiple admins can see/reply
- Full conversation history
- Professional appearance

**❌ Cons:**
- Requires MX record setup
- Admin can't reply from Gmail/Outlook
- Less personal

**Setup Required:**
- Add MX records to domain
- Configure Resend inbound routing

---

### 2. **`personal_email`** (Direct to Admin)
**Reply-To:** Admin's personal email (e.g., `aziz@gmail.com`)

**Flow:**
- AI Agent sends email
- Candidate replies to admin's Gmail
- Admin sees reply in Gmail inbox
- Admin replies from Gmail (natural threading)

**✅ Best For:**
- Small teams (1-2 recruiters)
- Personal touch important
- Existing email workflow
- Simple setup

**✅ Pros:**
- No domain setup needed
- Admin uses familiar email client
- More personal feel
- Natural email threading

**❌ Cons:**
- Conversations scattered across personal emails
- Hard to track/audit
- Other admins can't see replies
- No centralized dashboard

**Setup Required:**
- None! Works immediately

---

### 3. **`both`** (RECOMMENDED - Best of Both Worlds)
**Reply-To:** Admin's personal email  
**BCC:** `{orgslug}@wathefni.ai` (silent tracking)

**Flow:**
- AI Agent sends email with BCC to inbox
- Candidate replies to admin's Gmail
- Reply goes to admin's personal email
- **Also logged in inbox** (via BCC webhook)
- Admin can reply from Gmail OR Inbox UI

**✅ Best For:**
- Most organizations!
- Want flexibility
- Need tracking but also convenience

**✅ Pros:**
- ✅ Admin gets replies in Gmail (convenient)
- ✅ Still tracked in inbox (auditable)
- ✅ Other admins can see in Inbox tab
- ✅ Admin can reply from either place
- ✅ Natural + professional

**❌ Cons:**
- Admin sees replies in 2 places (minor)
- Requires BCC webhook support (already built!)

**Setup Required:**
- Minimal - just inbox tables (already created)

---

## How to Configure

### Quick Setup (Recommended: `both` mode)

Run in Neon SQL Console:

```sql
-- 1. Add inbox mode column (run the migration)
\i migrations/add-inbox-preferences.sql

-- 2. Set all orgs to 'both' mode (recommended)
UPDATE organizations SET inbox_mode = 'both';

-- 3. Verify
SELECT slug, name, inbox_mode FROM organizations;
```

### Per-Org Configuration

```sql
-- Different mode for each org
UPDATE organizations SET inbox_mode = 'both' WHERE slug = 'knet';
UPDATE organizations SET inbox_mode = 'inbox_only' WHERE slug = 'nbk';
UPDATE organizations SET inbox_mode = 'personal_email' WHERE slug = 'gb';
```

---

## Testing

After setting up, test with AI Agent:

```
"Send an email to Buthaina Alzoubi to schedule a meeting"
```

**Check Vercel logs** to see which mode is active:
```
[AI_AGENT_EMAIL] Reply-To: azizalmulla16@gmail.com
[AI_AGENT_EMAIL] Inbox mode: both
```

---

## My Recommendation

### Start with `both` mode:
- ✅ Easiest to set up
- ✅ Maximum flexibility
- ✅ Satisfies both tracking and convenience
- ✅ Can change later if needed

### Upgrade to `inbox_only` when:
- You have multiple admins
- You want professional shared inbox
- You're ready to set up MX records

### Use `personal_email` only if:
- Solo recruiter
- Don't care about tracking
- Want absolute simplicity

---

## Current Status

After running the migration and deploying:

1. ✅ All 3 modes supported in code
2. ✅ Default mode: `both` (if column doesn't exist yet)
3. ✅ Email logging works
4. ⏳ Need to run migration to add `inbox_mode` column
5. ⏳ Need to set preferred mode per org

---

## Next Steps

1. **Run migration**: `migrations/add-inbox-preferences.sql` in Neon
2. **Set mode**: `UPDATE organizations SET inbox_mode = 'both'`
3. **Deploy**: Already deployed!
4. **Test**: Send an email via AI Agent

**Questions? The system is production-ready with sensible defaults!**
