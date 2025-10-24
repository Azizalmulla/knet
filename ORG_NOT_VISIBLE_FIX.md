# Organization Not Showing in /start - Debug Guide

## The Issue

You created an org in super admin and it's visible there, but it doesn't appear in `/start` (company picker page).

## Root Cause

The `/start` page fetches from `/api/organizations/public` which filters by:
```sql
WHERE is_public = true AND deleted_at IS NULL
```

**Possible reasons your org is missing:**
1. `is_public` is set to `false` (unchecked the "Public" toggle)
2. `is_public` column is `NULL` (database schema issue)
3. `deleted_at` is set (org was soft-deleted)

---

## How to Diagnose

### Step 1: Check Server Logs

I've added debug logging. After deploying, visit `/start` and check your server logs:

```
[PUBLIC ORGS] All recent orgs: [
  { slug: 'your-new-org', is_public: false, deleted_at: null },  ← is_public is false!
  { slug: 'knet', is_public: true, deleted_at: null },
  ...
]

[PUBLIC ORGS] Returning 5 public orgs: ['knet', 'careerly', 'boubyan', ...]
```

This will show you:
- What orgs exist in the database
- Which ones have `is_public = true`
- Which ones are being returned to `/start`

### Step 2: Check Your Org in Super Admin

When you created the org, did you check the **"Public"** toggle?

**In the create org form:**
```
Name: [Your Org Name]
Slug: [your-slug]
☑️ Public (visible in picker)  ← THIS MUST BE CHECKED
```

**If unchecked:**
- `is_public = false`
- Org is hidden from `/start`
- Only accessible via private company code

---

## Quick Fixes

### Fix 1: Make Org Public (In Super Admin UI)

If you want it visible in `/start`:
1. Go to `/super-admin`
2. Find your org in the list
3. Look at the badge next to the name
   - **Public** = visible in /start ✅
   - **Private** = hidden from /start ❌
4. If it says "Private", you need to delete and recreate it with "Public" checked
   - OR manually update the database (see Fix 2)

### Fix 2: Update Database Directly

Run this SQL to make your org public:
```sql
UPDATE organizations 
SET is_public = true 
WHERE slug = 'your-org-slug';
```

### Fix 3: Check if Column Exists

If `is_public` column doesn't exist:
```sql
-- Add the column
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- Set existing orgs to public
UPDATE organizations 
SET is_public = true 
WHERE is_public IS NULL;
```

---

## Expected Behavior

### Public Org (is_public = true):
```
✅ Visible in /start company picker
✅ Anyone can select it
✅ No company code needed
✅ Shows up in grid of companies
```

**Use case:** KNET, NBK, Careerly - public job boards

### Private Org (is_public = false):
```
❌ Hidden from /start
✅ Accessible via direct URL: /{slug}/start
✅ Requires company code (optional)
✅ Not listed in company picker
```

**Use case:** Internal company portals, private recruiters

---

## Test After Fix

### Test 1: Visit /start
1. Go to `https://yourapp.com/start`
2. Your org should appear in the grid
3. You can select it

### Test 2: Check API Response
```bash
curl https://yourapp.com/api/organizations/public
```

Should return:
```json
{
  "organizations": [
    {
      "id": "abc-123",
      "slug": "your-org",
      "name": "Your Org Name",
      "is_public": true
    },
    ...
  ]
}
```

---

## Common Scenarios

### Scenario 1: You Unchecked "Public" by Mistake
**Issue:** Created org but didn't check "Public" toggle  
**Fix:** Delete org, recreate with "Public" checked

### Scenario 2: Schema Missing is_public Column
**Issue:** Old database schema  
**Fix:** Run migration to add column:
```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;
```

### Scenario 3: Org Was Deleted
**Issue:** `deleted_at` is set (soft delete)  
**Fix:** Either restore or create new:
```sql
-- Restore
UPDATE organizations SET deleted_at = NULL WHERE slug = 'your-org';

-- Or delete permanently and recreate
DELETE FROM organizations WHERE slug = 'your-org';
```

---

## What I Fixed

1. ✅ Added `deleted_at IS NULL` filter to public API
2. ✅ Added debug logging to show all orgs and which are returned
3. ✅ Better error handling

---

## Next Steps

### Deploy the Changes:
```bash
vercel --prod
```

### Then Test:
1. Visit `/start`
2. Check server logs for debug output
3. Share the logs if org still doesn't appear

**The logs will tell us:**
- Whether your org has `is_public = true`
- Whether it has `deleted_at = NULL`
- Why it's being filtered out

---

## Quick Answer

**Most likely:** You created the org but **didn't check the "Public" toggle**.

**Solution:**
1. Go to `/super-admin`
2. Delete the org (soft delete)
3. Click "New Organization"
4. Fill form
5. **✅ CHECK the "Public (visible in picker)" toggle**
6. Create
7. Visit `/start` - it should appear now!

Or just run:
```sql
UPDATE organizations SET is_public = true WHERE slug = 'your-org-slug';
```
