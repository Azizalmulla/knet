# Admin Invitation & Setup Guide

## The Issue

When you create an organization in super admin, **NO admin user is created automatically**. You need to manually invite admins.

---

## ✅ Complete Workflow

### Step 1: Create Organization (Already Done)
You did this already in `/super-admin`:
```
✅ Organization created
✅ Visible in super admin
❌ No admin users yet
❌ No one can log in
```

### Step 2: Invite Admin (YOU NEED TO DO THIS)

**In Super Admin Portal:**

1. Go to `/super-admin`
2. Find your new organization in the list
3. Click the **"Manage Admins (0)"** button
4. A dialog opens showing current admins (none yet)
5. Click **"Invite Admin"** button
6. Fill in the form:
   - **Email:** admin@example.com
   - **Role:** Admin (default)
7. Click **"Send Invite"**

**What happens:**
- ✅ Invite token generated
- ✅ Invite link copied to clipboard
- ✅ Email sent (if RESEND_API_KEY configured)
- ❌ If no email setup, **you must share the link manually**

**Invite link format:**
```
https://yourapp.com/{org-slug}/admin/accept-invite?token=abc123xyz
```

### Step 3: Admin Accepts Invitation

**Admin receives the link** (via email or you share it):

1. Admin clicks the link
2. Page shows:
   - ✅ Email pre-filled
   - ✅ Role displayed
   - 📝 Password input field
   - 📝 Confirm password field
3. Admin enters password (min 8 characters)
4. Admin clicks "Accept Invitation"
5. **Admin account is created**
6. Admin is automatically logged in
7. Redirected to `/{org-slug}/admin` dashboard

---

## 🔧 How to Invite an Admin (Step-by-Step)

### Method 1: With Email (Automatic)

**Prerequisites:**
- Set `RESEND_API_KEY` in environment variables
- Configure sender email in code

**Steps:**
1. Super admin invites admin
2. System sends email to admin@example.com
3. Email contains invite link
4. Admin clicks link and sets password
5. Done! ✅

### Method 2: Without Email (Manual)

**If you don't have email configured:**

1. Super admin invites admin
2. **Link is copied to clipboard automatically**
3. Super admin sends link to admin via:
   - WhatsApp
   - Email manually
   - Slack
   - Any messaging app
4. Admin clicks link and sets password
5. Done! ✅

---

## 📋 Current State of Your System

### Email Setup Status:

Check if you have `RESEND_API_KEY` in your environment:

```bash
# In .env.local or Vercel env vars
RESEND_API_KEY=re_abc123xyz
```

**If NO:**
- ❌ Emails won't be sent
- ✅ Invite links still work
- ⚠️ You must share links manually

**If YES:**
- ✅ Emails sent automatically
- ✅ Admin receives link in inbox
- ✅ Professional experience

---

## 🚀 Set Up Email Invitations (Optional)

### Option 1: Use Resend (Recommended)

1. **Sign up at https://resend.com** (free tier: 100 emails/day)

2. **Get API key:**
   - Go to API Keys
   - Create new key
   - Copy it

3. **Add to environment:**
```bash
# .env.local
RESEND_API_KEY=re_abc123xyz

# Vercel
vercel env add RESEND_API_KEY
# Paste key: re_abc123xyz
```

4. **Verify sender domain (optional but recommended):**
   - Add your domain in Resend
   - Update code to use your domain:
   ```typescript
   from: 'YourApp <noreply@yourdomain.com>'
   ```

5. **Redeploy:**
```bash
vercel --prod
```

### Option 2: Skip Email (Use Manual Links)

Just share the invite links manually - works fine for small teams!

---

## 🎯 Quick Test

### Test Admin Invitation Flow:

1. **Create test org:**
   - Name: Test Company
   - Slug: test-company
   - Public: ✅

2. **Invite yourself:**
   - Go to Manage Admins
   - Email: your-email@example.com
   - Click Invite

3. **Copy the link** (from clipboard or console)

4. **Open link in incognito window:**
   ```
   https://yourapp.com/test-company/admin/accept-invite?token=xyz
   ```

5. **Set password:**
   - Password: TestPassword123
   - Confirm: TestPassword123
   - Click Accept

6. **Verify:**
   - ✅ Redirected to `/test-company/admin`
   - ✅ Can see admin dashboard
   - ✅ Can view candidates
   - ✅ Can use AI agent

---

## 🔍 Troubleshooting

### Issue 1: "Manage Admins" shows (0) but you invited someone

**Cause:** Page not refreshed after invite  
**Fix:** Refresh the page or close/reopen the dialog

### Issue 2: Invite link expired

**Cause:** Links expire after 7 days  
**Fix:** Send a new invitation

### Issue 3: Admin can't set password

**Possible causes:**
- Token invalid/expired
- Network error
- Database issue

**Debug:**
```sql
-- Check invites
SELECT email, token, expires_at, status 
FROM admin_invites 
WHERE organization_id = 'org-uuid'
ORDER BY created_at DESC;
```

### Issue 4: Email not received

**Check:**
1. Is `RESEND_API_KEY` set?
2. Is email in spam folder?
3. Check server logs for email errors
4. Verify Resend dashboard for delivery status

**Fallback:** Share invite link manually

---

## 📊 Admin Invitation Database Tables

### `admin_invites` table:
```sql
CREATE TABLE admin_invites (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  role text DEFAULT 'admin',
  status text DEFAULT 'pending',
  created_by uuid REFERENCES super_admins(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### `admin_users` table:
```sql
CREATE TABLE admin_users (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, email)
);
```

---

## ⚡ Improvement Ideas

### Idea 1: Auto-invite on org creation

Add checkbox to org creation form:
```
[✓] Invite initial admin
Email: [admin@company.com]
```

Automatically sends invite when org is created.

### Idea 2: Better UX feedback

After creating org, show:
```
✅ Organization created!

⚠️ No admins yet. Next step:
[Invite Admin] button
```

### Idea 3: Bulk admin import

Upload CSV of emails:
```csv
email,role
admin1@company.com,owner
admin2@company.com,admin
viewer@company.com,viewer
```

Sends invites to all at once.

---

## 📝 Summary

### Current State:
1. ✅ Org creation works
2. ❌ No automatic admin creation
3. ✅ Manual invitation system exists
4. ⚠️ Email optional (manual link sharing works)

### What You Need to Do:

**For each new org:**
1. Create org in super admin
2. Click "Manage Admins (0)"
3. Click "Invite Admin"
4. Enter admin email
5. **Share the link** with them (clipboard or email)
6. Admin clicks link and sets password
7. Done!

### To Enable Email Invites (Optional):
```bash
# Get API key from resend.com
RESEND_API_KEY=re_abc123xyz

# Add to environment
vercel env add RESEND_API_KEY

# Redeploy
vercel --prod
```

---

## 🎯 Next Steps

### Immediate (Manual Workflow):
1. Go to `/super-admin`
2. Find your new org
3. Click "Manage Admins (0)"
4. Invite admin by email
5. Copy link from clipboard
6. Send to admin via WhatsApp/Email
7. Admin sets password and logs in

### Long-term (Automated):
1. Sign up for Resend.com
2. Add API key to environment
3. Configure sender domain
4. Test email delivery
5. Enjoy automated invites! 📧

---

**The system works perfectly** - you just need to complete Step 2 (invite admin) after creating the org! 🚀
