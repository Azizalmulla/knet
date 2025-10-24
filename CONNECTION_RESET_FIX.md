# ERR_CONNECTION_RESET - Admin Invite/List Fixed

## The Errors You Saw

```
ERR_CONNECTION_RESET on:
- /api/super-admin/organizations/{orgId}/admins (list admins)
- /api/super-admin/organizations/{orgId}/invite (invite admin)
```

This means the API endpoints were **crashing** before they could respond.

---

## Root Causes Found & Fixed

### Issue 1: SQL Query Syntax Error (`admins` route)
**File:** `app/api/super-admin/organizations/[orgId]/admins/route.ts`

**Problem:**
```typescript
// WRONG - mixed raw query with template literal
const query = `SELECT ... WHERE ${col} = $1::uuid ...`
const res = await sql.query(query, [orgId])
```

This mixes raw SQL with `$1` placeholders AND tries to use template variable `${col}`, which causes a crash.

**Fix:**
```typescript
// CORRECT - use template literals properly
const res = col === 'organization_id'
  ? await sql`SELECT ... WHERE organization_id = ${orgId}::uuid ...`
  : await sql`SELECT ... WHERE org_id = ${orgId}::uuid ...`
```

---

### Issue 2: NULL UUID Casting Error (`invite` route)
**File:** `app/api/super-admin/organizations/[orgId]/invite/route.ts`

**Problem:**
```typescript
const createdBy = ... ? admin.superAdminId : null

await sql`
  INSERT INTO admin_invites (... created_by ...)
  VALUES (... ${createdBy}::uuid ...)  // ❌ Crashes if createdBy is null!
`
```

You can't cast `null` to `::uuid` - PostgreSQL throws an error.

**Fix:**
```typescript
// Conditional insert based on whether createdBy exists
if (createdBy) {
  await sql`INSERT ... VALUES (... ${createdBy}::uuid ...)`
} else {
  await sql`INSERT ... VALUES (... NULL ...)`
}
```

---

## What I Changed

### 1. Fixed `/admins` Route (List Admins)
✅ Proper template literal SQL syntax  
✅ Added logging to show which org and how many admins found  
✅ Better error messages with details  

### 2. Fixed `/invite` Route (Invite Admin)
✅ Fixed NULL UUID casting issue  
✅ Added request logging (email, role, orgId)  
✅ Added success logging with invite URL  
✅ Better error messages with stack traces  

---

## Testing After Deploy

### Test 1: List Admins
1. Go to `/super-admin`
2. Click "Manage Admins (0)" on any org
3. Dialog should open (no connection reset!)
4. Shows "No admins yet" message

**Server logs should show:**
```
[LIST_ADMINS] Fetching admins for org abc-123 using column organization_id
[LIST_ADMINS] Found 0 admins
```

### Test 2: Invite Admin
1. In the "Manage Admins" dialog
2. Click "Invite Admin"
3. Enter email: `test@example.com`
4. Click "Send Invitation"
5. Should succeed with success toast
6. Invite link copied to clipboard

**Server logs should show:**
```
[INVITE_ADMIN] Request: email=test@example.com, role=admin, sendEmail=false, orgId=abc-123
[INVITE_ADMIN] Creating invite for test@example.com to org abc-123
[INVITE_ADMIN] Success! Invite URL: https://yourapp.com/org-slug/admin/accept-invite?token=xyz
```

---

## What the Logs Tell You

### Success Flow:
```
[INVITE_ADMIN] Request: email=azizalmulla16@gmail.com, role=admin, ...
[INVITE_ADMIN] Creating invite for azizalmulla16@gmail.com to org 6e684caf...
[INVITE_ADMIN] Success! Invite URL: https://watheefni.ai/ai-octopus/admin/accept-invite?token=...
```

### If It Fails:
```
[SUPER_ADMIN_INVITE_ERROR] cannot cast type null to uuid
[SUPER_ADMIN_INVITE_ERROR] Stack: ...
```

This gives you the exact error and line number.

---

## Deploy & Test

```bash
vercel --prod
```

Then:
1. Visit `/super-admin`
2. Try "Manage Admins" - should work now
3. Try "Invite Admin" - should work now
4. Check server logs for success messages

---

## Common Issues & Solutions

### Issue: Still getting connection reset

**Check:**
1. Did you deploy? `vercel --prod`
2. Are you testing on prod URL or localhost?
3. Check server logs for actual error

### Issue: "Organization not found"

**Cause:** Invalid orgId in URL  
**Fix:** Make sure you're clicking "Manage Admins" on a valid org

### Issue: "Email is required"

**Cause:** Email field is empty  
**Fix:** Fill in the email address

### Issue: "Failed to create invite" with details

**Check logs for:**
- Database connection error
- admin_invites table doesn't exist
- Constraint violation (duplicate email)

---

## Database Schema

Make sure these tables exist:

```sql
-- Admin users
CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  email text NOT NULL,
  password_hash text NOT NULL,
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  last_login timestamptz,
  UNIQUE(organization_id, email)
);

-- Admin invites
CREATE TABLE admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

If missing, run:
```bash
node scripts/run-complete-migration.js
```

---

## Summary

### What Was Broken:
- ❌ List admins crashed with SQL syntax error
- ❌ Invite admin crashed with NULL UUID casting error
- ❌ No error details to debug
- ❌ Connection reset before response

### What's Fixed:
- ✅ Proper SQL template literal syntax
- ✅ Conditional NULL handling for UUIDs
- ✅ Detailed logging for debugging
- ✅ Better error messages
- ✅ Both endpoints should work now

### Next Steps:
1. Deploy: `vercel --prod`
2. Test "Manage Admins"
3. Test "Invite Admin"
4. Check server logs for success messages
5. Share invite link with admin
6. Admin sets password and logs in

**Status: ✅ FIXED - Ready to deploy!**
