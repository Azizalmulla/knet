# KNET AI CV Builder

AI-powered CV builder and uploader for KNET career matching and recruitment.

## Pre-Launch Checklist

✅ **Admin Authentication & Security**
- ADMIN_KEY server-side authentication
- Rate limiting (5 attempts/5min per IP)
- Auto-logout on 401 responses
- 30-minute inactivity timeout
- Audit logging with IP + timestamp
- Production-only admin access on Preview

✅ **Error Boundaries** 
- Global ErrorBoundary on /upload and /ai-builder
- Friendly fallback with retry functionality
- Redacted error logging

✅ **CV Builder Wizard**
- Unified FormProvider + Zod validation
- Step-by-step navigation with validation
- Field validation for English/Arabic

✅ **Career Map Integration**
- careerMapRows as single source of truth
- Helper functions: getFields(), getAreasForField(), matchSuggestedVacancies()
- Suggested vacancies saved verbatim to Postgres

✅ **Privacy & Compliance**
- Privacy Notice on /upload (12-month retention, privacy@knet.kw)
- GDPR/PII workflow via /api/admin/gdpr
- Admin CSV export with PII masking toggles

✅ **Storage & Database**
- Neon Postgres with migrations applied
- Vercel Blob private storage with admin proxy
- Index on (field_of_study, area_of_interest)
- suggested_vacancies_list column for filtering

## Regression Prompt

Run `npm run check:all`; if anything fails, fix app code/mocks (not tests), keep Playwright separate from Jest, preserve the career-map snapshot unless I provide new JSON, and output failing specs + minimal diffs.

## ADMIN_KEY Rotation Policy

**Monthly Rotation Schedule:**
- Rotate `ADMIN_KEY` on the 1st of each month
- Current key format: `knet[month][year][random]` (e.g., `knet0124xyz`)

**Rotation Steps:**
1. **Generate New Key**: Create secure 12+ character key
2. **Update Vercel**: 
   - Go to [Vercel Dashboard](https://vercel.com) → Project Settings → Environment Variables
   - Update `ADMIN_KEY` for Production environment
   - Redeploy: `vercel --prod`
3. **Notify KNET HR**: Send new key via secure channel (encrypted email/Slack DM)
4. **Verify Access**: Test login at production `/admin` with new key
5. **Document**: Update this README with rotation date

**Key Recipients:**
- HR Manager (primary contact)
- IT Administrator (backup)
- Project Lead (technical support)

**Security Notes:**
- Never share keys in plaintext channels
- Use environment variables, never hardcode
- Audit login attempts monthly via server logs
- Immediately rotate if suspected compromise

**Last Rotation:** [Update after each rotation]

## Local Testing

\`\`\`bash
# Unit tests (Jest)
npm test

# E2E fast (Chromium only)
npm run e2e

# E2E full matrix (before merging)
npm run e2e:full

# Full check: unit then Chromium E2E
npm run check:all
\`\`\`
## Deployment

Your project is live at:

**[https://vercel.com/azizalmulla16-gmailcoms-projects/v0-form-template](https://vercel.com/azizalmulla16-gmailcoms-projects/v0-form-template)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/6DCu0jpeA6I](https://v0.app/chat/projects/6DCu0jpeA6I)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository