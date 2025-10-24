# Organization Feature Flags - What They Do

## TL;DR - Current Status

**⚠️ IMPORTANT:** These toggles are **NOT currently enforced** in the codebase!

They exist in the database and UI, but **no code checks them** before allowing access to features. This means:
- Turning them OFF won't actually disable anything
- Turning them ON won't enable anything new
- They're **placeholders for future feature gating**

---

## The Three Feature Flags

### 1. **AI Builder** (`enable_ai_builder`)
**Intended Purpose:** Control access to the AI CV Builder

**What it SHOULD do:**
- ✅ ON: Students can use `/ai-builder` to create CVs with AI assistance
- ❌ OFF: AI Builder route returns 403 or redirects to upload-only flow

**Current Reality:**
- No enforcement - anyone can access `/ai-builder` regardless of flag
- Flag is stored in database but never checked

**Where it should be checked:**
- `app/[org]/ai-builder/page.tsx` - Check org's `enable_ai_builder` flag
- `app/api/ai/career-assistant/route.ts` - Reject requests if disabled
- Navigation menus - Hide AI Builder link if disabled

---

### 2. **Exports** (`enable_exports`)
**Intended Purpose:** Control PDF/CSV export capabilities

**What it SHOULD do:**
- ✅ ON: Admins can export candidate lists to CSV/PDF
- ❌ OFF: Export buttons hidden, API returns 403

**Current Reality:**
- No enforcement - all orgs can export regardless of flag
- Export endpoints don't check the flag

**Where it should be checked:**
- `app/api/[org]/admin/candidates/export/route.ts` - Check before exporting
- `app/api/[org]/admin/export/candidates.csv/route.ts` - Check before CSV generation
- Admin dashboard - Hide export buttons if disabled

---

### 3. **Analytics** (`enable_analytics`)
**Intended Purpose:** Control access to analytics dashboard

**What it SHOULD do:**
- ✅ ON: Admins see analytics tab with charts/metrics
- ❌ OFF: Analytics tab hidden

**Current Reality:**
- No enforcement - analytics features accessible to all
- No analytics dashboard exists yet (placeholder)

**Where it should be checked:**
- `app/[org]/admin/analytics/page.tsx` - Check before rendering
- Navigation - Hide analytics tab if disabled

---

## Why These Exist

### Use Case 1: Tiered Pricing
```
Free Tier:
- ❌ AI Builder disabled
- ❌ Exports disabled  
- ✅ Analytics enabled

Pro Tier ($99/month):
- ✅ AI Builder enabled
- ✅ Exports enabled
- ✅ Analytics enabled
```

### Use Case 2: Beta Features
```
Stable Orgs:
- ✅ AI Builder (stable)
- ✅ Exports (stable)
- ❌ Analytics (beta - not ready)

Beta Testers:
- ✅ All features enabled
```

### Use Case 3: Compliance/Security
```
High-Security Org:
- ❌ AI Builder (no external API calls)
- ❌ Exports (no data export allowed)
- ✅ Analytics (internal only)
```

---

## What Happens If You Toggle Them Now?

### Scenario: Turn OFF "AI Builder" for KNET

**Expected behavior:**
- KNET students can't access AI Builder
- They see "Feature not available" message
- API rejects AI requests from KNET

**Actual behavior:**
- ✅ Toggle updates database: `enable_ai_builder = false`
- ❌ Students can still access AI Builder
- ❌ API still processes requests
- ❌ No visible change to users

**Why?** No code checks the flag!

---

## How to Actually Enforce These Flags

### Step 1: Add Middleware Check

Create `lib/check-org-feature.ts`:
```typescript
import { sql } from '@/lib/db';

export async function checkOrgFeature(
  orgSlug: string, 
  feature: 'enable_ai_builder' | 'enable_exports' | 'enable_analytics'
): Promise<boolean> {
  const result = await sql`
    SELECT ${feature} as enabled
    FROM organizations
    WHERE slug = ${orgSlug} AND deleted_at IS NULL
    LIMIT 1
  `;
  
  return result.rows[0]?.enabled ?? false;
}
```

### Step 2: Protect AI Builder Route

Update `app/[org]/ai-builder/page.tsx`:
```typescript
import { checkOrgFeature } from '@/lib/check-org-feature';
import { redirect } from 'next/navigation';

export default async function AIBuilderPage({ params }: { params: { org: string } }) {
  const hasAccess = await checkOrgFeature(params.org, 'enable_ai_builder');
  
  if (!hasAccess) {
    redirect(`/${params.org}/start?error=feature_disabled`);
  }
  
  // Render AI Builder...
}
```

### Step 3: Protect Export API

Update `app/api/[org]/admin/candidates/export/route.ts`:
```typescript
import { checkOrgFeature } from '@/lib/check-org-feature';

export async function GET(request: NextRequest, { params }: { params: { org: string } }) {
  const hasExports = await checkOrgFeature(params.org, 'enable_exports');
  
  if (!hasExports) {
    return NextResponse.json({ 
      error: 'Export feature not enabled for this organization' 
    }, { status: 403 });
  }
  
  // Continue with export...
}
```

### Step 4: Hide UI Elements

Update admin dashboard:
```typescript
const org = await getOrganization(orgSlug);

return (
  <div>
    {org.enable_exports && (
      <Button onClick={exportToCsv}>Export to CSV</Button>
    )}
    
    {org.enable_analytics && (
      <Link href={`/${orgSlug}/admin/analytics`}>Analytics</Link>
    )}
  </div>
);
```

---

## Database Schema

```sql
CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  
  -- Feature flags (defaults to true)
  enable_ai_builder boolean DEFAULT true,
  enable_exports boolean DEFAULT true,
  enable_analytics boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now()
);
```

**Current values for your orgs:**
```sql
SELECT slug, enable_ai_builder, enable_exports, enable_analytics 
FROM organizations;

-- All default to TRUE
knet              | true | true | true
careerly          | true | true | true
boubyan           | true | true | true
nbk               | true | true | true
demo              | true | true | true
```

---

## Testing Feature Flags (After Implementation)

### Test 1: Disable AI Builder
```bash
# 1. Turn OFF AI Builder for KNET in super admin
# 2. Try to access: https://yourapp.com/knet/ai-builder
# Expected: Redirect to /knet/start with error message
# Actual (now): Still accessible ❌
```

### Test 2: Disable Exports
```bash
# 1. Turn OFF Exports for KNET
# 2. Login as KNET admin
# 3. Try to export candidates
# Expected: Export button hidden, API returns 403
# Actual (now): Export still works ❌
```

### Test 3: Disable Analytics
```bash
# 1. Turn OFF Analytics for KNET
# 2. Login as KNET admin
# 3. Look for analytics tab
# Expected: Tab hidden
# Actual (now): No analytics tab exists yet (feature not built)
```

---

## Implementation Checklist

To make these flags actually work:

### AI Builder:
- [ ] Add feature check to `app/[org]/ai-builder/page.tsx`
- [ ] Add feature check to `app/api/ai/career-assistant/route.ts`
- [ ] Hide AI Builder link in navigation if disabled
- [ ] Show "Feature not available" message if accessed directly

### Exports:
- [ ] Add feature check to `app/api/[org]/admin/candidates/export/route.ts`
- [ ] Add feature check to `app/api/[org]/admin/export/candidates.csv/route.ts`
- [ ] Hide export buttons in admin UI if disabled
- [ ] Return 403 from API if disabled

### Analytics:
- [ ] Build analytics dashboard first (doesn't exist yet)
- [ ] Add feature check to analytics routes
- [ ] Hide analytics tab if disabled

### General:
- [ ] Create `lib/check-org-feature.ts` utility
- [ ] Add feature flag checks to middleware
- [ ] Update documentation
- [ ] Test all scenarios

---

## Recommended Approach

### Option 1: Implement Now (If Needed)
If you want to use these for tiered pricing or beta features:
1. Follow the implementation steps above
2. Test thoroughly
3. Update pricing page to show feature differences
4. Deploy

**Effort:** ~4-6 hours

### Option 2: Leave As-Is (Current State)
If all orgs get all features for now:
1. Keep toggles in UI (for future use)
2. Don't enforce them yet
3. Implement when you need tiered pricing
4. All orgs have full access

**Effort:** 0 hours (current state)

---

## Summary

### What the toggles do NOW:
- ✅ Update database values
- ✅ Show in super admin UI
- ❌ Don't actually restrict access
- ❌ Don't change user experience

### What they SHOULD do:
- ✅ Control access to AI Builder
- ✅ Control export capabilities  
- ✅ Control analytics access
- ✅ Enable tiered pricing

### What you should do:
**If you don't need feature gating yet:** Leave as-is, all orgs get all features

**If you want to restrict features:** Implement the checks following the guide above

**Current recommendation:** Leave enabled (all TRUE) until you need tiered pricing or beta testing.

---

## Quick Answer to Your Question

> "What happens if I turn it on?"

**Nothing changes** - they're already ON by default (all set to `true`).

> "What happens if I turn it off?"

**Nothing changes** - the flags aren't enforced in the code yet. Users can still access all features.

**Bottom line:** These are **future-proofing** for when you want to offer different pricing tiers or restrict features. Right now, they're just database fields with no effect on the application.
