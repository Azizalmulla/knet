# Careerly Master Setup Guide

## 🚀 Complete Multi-Tenant Platform with Super Admin

### Overview
Careerly is a fully multi-tenant CV submission and recruitment platform for Kuwait organizations with:
- **Super Admin Portal** for platform management
- **Per-Organization Isolation** with separate admin dashboards
- **Company Picker** for public/private access
- **Watheefti-Compliant** student submission forms
- **AI-Powered** candidate search (tenant-scoped)
- **Full i18n** support (EN/AR)

## Installation

### 1. Install Dependencies
```bash
# Core dependencies
npm install jsonwebtoken bcryptjs qrcode
npm install @radix-ui/react-checkbox @radix-ui/react-switch @radix-ui/react-tabs

# Types
npm install --save-dev @types/jsonwebtoken @types/bcryptjs @types/qrcode
```

### 2. Run Database Migration
```bash
# Set your database URL first
export DATABASE_URL="your-neon-connection-string"

# Run the complete schema migration
psql $DATABASE_URL < migrations/complete-careerly-schema.sql
```

### 3. Start Development Server
```bash
npm run dev
```

## Access Points

### 🛡️ Super Admin Portal
- **Login**: `/super-admin/login`
- **Dashboard**: `/super-admin`
- **Default Credentials**: 
  - Email: `super@careerly.com`
  - Password: `super123`
  - (Or set via env: `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`)

### 🏢 Organization Routes
- **Company Picker**: `/start`
- **Student Submission**: `/{org}/start`
- **Admin Login**: `/{org}/admin/login`
- **Admin Dashboard**: `/{org}/admin`

## Super Admin Features

### Organization Management
1. **Create Organizations**
   - Set name, slug, public/private status
   - Generate company codes for private access
   - Upload logos
   - Configure email domains

2. **Feature Flags per Org**
   - `enable_ai_builder` - AI CV Builder access
   - `enable_exports` - CSV/PDF export capability
   - `enable_analytics` - Analytics dashboard

3. **Admin User Management**
   - Invite admins via email
   - Generate one-time invite links (72h expiry)
   - Set roles: owner, admin, viewer
   - Reset passwords

4. **Quick Links & QR Codes**
   - Auto-generate student submission links
   - Create QR codes for easy access
   - Copy admin login URLs

## Student Submission Form

### Watheefti-Compliant Fields
```typescript
// Required fields with Kuwait-specific options
- Full Name (required)
- Email (required, validated)
- Phone (required, +965 format)
- Field of Study (dropdown + "Others" with text input)
- Area of Interest (single select)
- Degree (High School to PhD)
- Years of Experience (0-1, 2-3, 4-5, 6+)
- GPA (optional, 0.00-4.00)
- CV Upload (PDF only, max 10MB)
```

### Features
- EN/AR bilingual support
- RTL layout for Arabic
- Phone number normalization (+965)
- Arabic numeral support
- Blob storage with org prefixes

## Admin Dashboard Features

### Candidate Management
- View all organization candidates
- Advanced filters:
  - Degree level
  - Years of experience
  - Field of study (including "Others")
  - Area of interest
  - Full-text search
- Actions:
  - Delete individual candidates
  - Bulk delete all
  - Export to CSV/PDF

### AI Agent (Tenant-Scoped)
```sql
-- All queries automatically filtered by org
SELECT * FROM candidates 
WHERE organization_id = :session.orgId
```

### Security
- JWT-based authentication
- Organization isolation enforced in middleware
- Rate limiting on all mutations
- Audit logging for all actions

## Data Isolation Architecture

### Middleware Protection
```typescript
// Every request validates org access
if (session.orgId !== requestedOrgId) {
  return redirect('/login')
}
```

### Database Queries
```sql
-- Always filter by organization_id
WHERE organization_id = :orgId
```

### Blob Storage
```
blobs/{orgSlug}/cv-{timestamp}.pdf
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...

# Security
JWT_SECRET=your-secret-key-here
NEXTAUTH_SECRET=your-secret-key-here

# Super Admin (optional)
SUPER_ADMIN_EMAIL=super@careerly.com
SUPER_ADMIN_PASSWORD=super123

# Optional
COOKIE_DOMAIN=.careerly.com  # For subdomain sharing
```

## Testing Flow

### 1. Super Admin Creates Organization
```
1. Login to /super-admin
2. Click "New Organization"
3. Enter: KNET, knet, public
4. Generate QR code
5. Copy student link
```

### 2. Student Submits CV
```
1. Visit /knet/start (or scan QR)
2. Fill Watheefti form
3. Upload CV
4. Submit
```

### 3. Admin Reviews
```
1. Login to /knet/admin
2. View candidates
3. Use filters
4. Export or delete
```

### 4. Cross-Org Isolation Test
```
1. Login to /knet/admin
2. Try accessing /nbk/admin
3. Should redirect to login (blocked)
```

## Production Checklist

### Security
- [ ] Set strong `JWT_SECRET`
- [ ] Enable HTTPS
- [ ] Configure rate limiting
- [ ] Set up monitoring

### Database
- [ ] Run migrations
- [ ] Create indexes
- [ ] Set up backups
- [ ] Configure connection pooling

### Storage
- [ ] Configure Vercel Blob
- [ ] Set storage limits
- [ ] Implement cleanup jobs

### Features
- [ ] Configure feature flags per org
- [ ] Set up email service for invites
- [ ] Implement password reset flow
- [ ] Add 2FA for super admin

## API Endpoints

### Super Admin
```
POST   /api/super-admin/login
GET    /api/super-admin/verify
GET    /api/super-admin/organizations
POST   /api/super-admin/organizations
PATCH  /api/super-admin/organizations/:id/features
POST   /api/super-admin/organizations/:id/invite
GET    /api/super-admin/organizations/:id/admins
POST   /api/super-admin/logout
```

### Organization Admin
```
POST   /api/{org}/admin/login
POST   /api/{org}/admin/logout
GET    /api/{org}/admin/candidates
DELETE /api/{org}/admin/candidates/:id
POST   /api/{org}/admin/export/csv
POST   /api/{org}/admin/export/pdf
POST   /api/{org}/admin/agent/query
```

### Public
```
GET    /api/organizations/public
POST   /api/organizations/verify-code
GET    /api/organizations/{slug}/info
POST   /api/{org}/submit
```

## Troubleshooting

### "Organization not found"
- Check slug exists in database
- Verify middleware is resolving correctly
- Check for typos in URL

### "Unauthorized" errors
- Verify JWT_SECRET is set
- Check cookie is being set
- Verify organization_id matches

### Blob upload failures
- Check Vercel Blob configuration
- Verify storage limits
- Check file size/type

### Cross-org data leakage
- Review all queries for WHERE organization_id
- Check middleware enforcement
- Audit API routes

## Support

For issues or questions:
1. Check audit logs in super admin portal
2. Review middleware logs
3. Verify database constraints
4. Check browser console for errors

---

**Built for Kuwait 🇰🇼** - Supporting KNET, NBK, Zain, and all Kuwait organizations
