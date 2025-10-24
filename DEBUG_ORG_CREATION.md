# Debug Organization Creation 400 Error

## What I Fixed

Added detailed logging on both client and server to identify the 400 error cause.

## How to Debug

### Step 1: Open Browser Console
1. Go to `/super-admin`
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to **Console** tab
4. Clear console

### Step 2: Try Creating an Org
1. Click "New Organization"
2. Fill in the form:
   - **Name:** Test Company
   - **Slug:** test-company
   - Check "Public"
3. Click "Create Organization"

### Step 3: Check Console Logs

You'll see:
```
[CREATE ORG] Sending payload: {
  name: "Test Company",
  slug: "test-company",
  is_public: true,
  company_code: null,
  logo_url: null
}
```

### Step 4: Check Server Logs

In your terminal where Next.js is running, you'll see one of:

#### Scenario A: Missing fields
```
[CREATE ORG] Missing required fields: { name: null, slug: null }
```
**Cause:** Form inputs don't have correct `name` attributes

#### Scenario B: Invalid slug format
```
[CREATE ORG] Invalid slug format: Test-Company
```
**Cause:** Slug has uppercase letters (must be lowercase)

#### Scenario C: Duplicate slug
```
[CREATE ORG] Slug already exists: test-company
```
**Cause:** Organization with that slug already exists

#### Scenario D: Database error
```
Failed to create organization: [database error details]
```
**Cause:** SQL issue (missing columns, constraint violation, etc.)

---

## Common Issues & Fixes

### Issue 1: "Invalid slug format"
**Error:** Slug contains uppercase, spaces, or special characters

**Fix:** Use only:
- Lowercase letters (a-z)
- Numbers (0-9)
- Hyphens (-)

**Examples:**
- ✅ `test-company`
- ✅ `acme-corp-123`
- ❌ `Test-Company` (uppercase)
- ❌ `test_company` (underscore)
- ❌ `test company` (space)

### Issue 2: "Slug already exists"
**Error:** Another org is using that slug

**Fix:** Choose a different slug
- `test-company` → `test-company-2`
- `acme` → `acme-inc`

### Issue 3: Form fields not sending
**Error:** `name` or `slug` is null

**Fix:** Check form HTML has correct `name` attributes:
```tsx
<Input name="name" />    // ✅ Correct
<Input id="name" />      // ❌ Wrong - needs name, not just id
```

### Issue 4: Switch value not working
**Error:** `is_public` always false

**Fix:** Check switch HTML:
```tsx
<Switch name="is_public" />  // Sends 'on' when checked
```

Client converts `'on'` to boolean:
```typescript
is_public: formData.get('is_public') === 'on'
```

---

## Test Cases

### Test 1: Basic Org Creation
```
Name: Test Organization
Slug: test-org
Public: ✅ Checked
Company Code: (leave empty)
Logo URL: (leave empty)

Expected: ✅ Success
```

### Test 2: With Company Code
```
Name: Private Corp
Slug: private-corp
Public: ❌ Unchecked
Company Code: ABC123
Logo URL: (leave empty)

Expected: ✅ Success
```

### Test 3: With Logo
```
Name: Branded Company
Slug: branded-co
Public: ✅ Checked
Company Code: (leave empty)
Logo URL: https://example.com/logo.png

Expected: ✅ Success
```

### Test 4: Invalid Slug (Uppercase)
```
Name: Bad Slug Test
Slug: Bad-Slug

Expected: ❌ Error: "Invalid slug format"
```

### Test 5: Duplicate Slug
```
Name: Duplicate Test
Slug: knet  (already exists)

Expected: ❌ Error: "Organization with this slug already exists"
```

---

## After Running Tests

**Report back:**
1. What you see in browser console
2. What you see in terminal (server logs)
3. The exact error message from toast notification

This will tell us exactly what's failing!

---

## Quick Fix Commands

### If slug validation is the issue:
Slugs must be lowercase. Convert before submitting:
```typescript
slug: formData.get('slug')?.toString().toLowerCase()
```

### If duplicate slug:
Check existing orgs:
```sql
SELECT slug FROM organizations;
```

Rename the slug or delete the old one:
```sql
DELETE FROM organizations WHERE slug = 'test-company';
```

---

## Expected Behavior (After Fix)

### Success Response:
```json
{
  "success": true,
  "organization": {
    "id": "abc-123-def",
    "name": "Test Company",
    "slug": "test-company",
    "is_public": true,
    "company_code": null
  },
  "links": {
    "student": "/test-company/start",
    "admin": "/test-company/admin/login"
  }
}
```

### Success Toast:
```
✅ Organization "Test Company" created!
```

### UI Updates:
- Modal closes
- New org appears in the list
- QR code generated

---

## Next Steps

1. **Try creating an org** with the logging enabled
2. **Check both consoles** (browser + terminal)
3. **Copy the error logs** and share them
4. I'll tell you exactly what to fix!

**The logs will show us:**
- What data is being sent
- Which validation is failing
- The exact error message

Let's find out what's breaking! 🔍
