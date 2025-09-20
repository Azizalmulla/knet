# Per-Organization Admin Authentication System

## Overview

Complete multi-tenant admin authentication system with strict data isolation between organizations. Each organization has its own admin users who can only access their organization's data.

## Architecture

### Database Schema

```sql
organizations
├── id (UUID)
├── slug (unique) - URL identifier (e.g., 'knet', 'nbk')
├── name - Display name
├── is_public - Visible in company picker
├── company_code - Private access code
├── logo_url - Organization logo
└── domains (JSONB) - Email domain hints

admin_users
├── id (UUID)
├── organization_id (FK) - Scoped to organization
├── email
├── email_lc (generated) - Lowercase for unique constraint
├── password_hash - Bcrypt (12 rounds)
├── role - owner | admin | viewer
└── UNIQUE(organization_id, email_lc)

admin_sessions
├── id (UUID)
├── admin_id (FK)
├── organization_id (FK)
├── token_hash - SHA256 of JWT
├── ip_address
├── user_agent
├── expires_at
└── revoked - For session invalidation
```

## Security Features

### 1. Organization Isolation
- **URL-based**: `/{org}/admin/*` routes
- **Middleware enforcement**: Cross-org access blocked
- **Database queries**: Always filtered by `organization_id`
- **JWT validation**: Session contains `orgId`, verified on every request

### 2. Authentication Flow
```
1. Admin visits /{org}/admin/login
2. Submits email + password
3. Server verifies:
   - Organization exists
   - Admin belongs to organization
   - Password matches (bcrypt.compare)
4. Creates JWT with:
   - sessionId (for revocation)
   - adminId
   - orgId (critical for isolation)
   - role
   - expiry (1 day or 30 days)
5. Sets HTTP-only cookie
6. Stores session in database
```

### 3. Rate Limiting
- **5 attempts per minute** per IP+email combination
- Prevents brute force attacks
- Audit logging for failed attempts

### 4. Session Management
- **HTTP-only cookies**: Prevents XSS attacks
- **Signed JWT**: Tamper-proof
- **Session tracking**: Database record for each session
- **Revocation support**: Can invalidate sessions
- **Remember me**: 30-day sessions available

### 5. Audit Logging
```
[AUDIT] Successful admin login: knet - admin@knet.com - 192.168.1.1
[AUDIT] Rate limit exceeded: nbk - attacker@evil.com - 10.0.0.1
[SECURITY] Cross-org access attempt: knet trying to access nbk
```

## Routes & Endpoints

### Pages
- `/{org}/admin/login` - Login form
- `/{org}/admin` - Dashboard (protected)
- `/{org}/admin/logout` - Clear session

### APIs
- `POST /api/{org}/admin/login` - Authenticate
- `POST /api/{org}/admin/logout` - Clear cookie
- `GET /api/{org}/admin/csrf` - Get CSRF token
- `GET /api/organizations/{slug}/info` - Public org info

## Implementation Files

### Core Components
```
app/[org]/admin/login/page.tsx       - Login UI
app/api/[org]/admin/login/route.ts   - Auth endpoint
app/api/[org]/admin/logout/route.ts  - Logout endpoint
middleware.ts                         - JWT validation & protection
```

### Database & Scripts
```
migrations/enhanced-org-admin-auth.sql - Schema
scripts/seed-admin.ts                   - Create admins
scripts/test-auth-flow.ts              - Test suite
scripts/run-enhanced-migration.js      - Migration runner
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install jsonwebtoken bcryptjs @radix-ui/react-checkbox
npm install --save-dev @types/jsonwebtoken @types/bcryptjs
```

### 2. Run Migration
```bash
node scripts/run-enhanced-migration.js
```

### 3. Create Admin Users
```bash
node scripts/seed-admin.ts
```

### 4. Test Authentication
```bash
npx ts-node scripts/test-auth-flow.ts
```

## Testing Scenarios

### ✅ Successful Login
1. Visit `/knet/admin/login`
2. Enter valid credentials
3. Access granted to `/knet/admin`

### ❌ Cross-Org Access (Blocked)
1. Login to `/knet/admin`
2. Try to access `/nbk/admin`
3. Redirected to `/nbk/admin/login`

### ❌ Invalid Credentials
1. Wrong password → 401 error
2. Non-existent email → 401 error
3. Wrong organization → 404 error

### ❌ Rate Limiting
1. 5 failed attempts
2. 429 Too Many Requests
3. Wait 1 minute to retry

## Data Access Rules

### Critical: Always filter by organization_id

```typescript
// ✅ CORRECT - Uses session orgId
const candidates = await sql`
  SELECT * FROM candidates 
  WHERE organization_id = ${session.orgId}
`

// ❌ WRONG - Trusts client input
const candidates = await sql`
  SELECT * FROM candidates 
  WHERE organization_id = ${req.body.orgId}  // NEVER DO THIS!
`
```

### Middleware Protection
```typescript
// Automatically enforced in middleware.ts
if (decoded.orgId !== org.id) {
  // Block cross-org access
  return redirect(`/${orgSlug}/admin/login`)
}
```

## Production Checklist

- [ ] Set strong `JWT_SECRET` environment variable
- [ ] Enable HTTPS for secure cookies
- [ ] Configure `COOKIE_DOMAIN` for subdomains
- [ ] Set up monitoring for failed login attempts
- [ ] Implement password reset flow
- [ ] Add 2FA for sensitive organizations
- [ ] Regular session cleanup (expired tokens)
- [ ] Audit log retention policy

## Security Best Practices

1. **Never trust client-provided org IDs** - Always use session
2. **Log all authentication events** - For security audit
3. **Implement session timeout** - Auto-logout after inactivity
4. **Use strong passwords** - Minimum 8 characters
5. **Rotate JWT secrets** - Monthly rotation recommended
6. **Monitor cross-org attempts** - Potential security breach

## Acceptance Criteria ✅

- [x] KNET admin cannot access NBK data
- [x] All queries filtered by organization_id
- [x] JWT contains orgId and validated
- [x] Rate limiting prevents brute force
- [x] Sessions tracked in database
- [x] Audit logging implemented
- [x] Cross-org access blocked
- [x] HTTP-only cookies used
- [x] 30-day remember me option
- [x] CSRF protection ready

## Support

For issues or questions:
1. Check audit logs for security events
2. Verify organization exists in database
3. Ensure admin_users has correct organization_id
4. Check middleware logs for access attempts
