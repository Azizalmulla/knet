# 🚀 Careerly Complete Setup Instructions

## ✅ What's Been Implemented

### 1. **Super Admin Portal** (`/super-admin`)
- Platform owner dashboard for managing organizations
- Create/edit organizations with feature flags
- Invite admins with one-time tokens
- Generate QR codes and links
- Audit logging

### 2. **Multi-Tenant Architecture** 
- Complete organization isolation
- Per-org routing: `/{org}/start`, `/{org}/admin`
- Middleware enforcement of data boundaries
- JWT-based authentication per organization

### 3. **Watheefti-Compliant Forms** (`/{org}/start`)
- Kuwait-specific field options
- "Others" with text input for field of study
- Phone normalization (+965)
- Arabic numeral support
- GPA validation (0.00-4.00)

### 4. **Enhanced Security**
- Super admin separate auth
- Per-org admin isolation  
- Rate limiting (5/min)
- CSRF protection
- HTTP-only cookies
- Session tracking

## 📦 Installation Steps

### Step 1: Install ALL Dependencies
```bash
# Core packages
npm install jsonwebtoken bcryptjs qrcode
npm install @radix-ui/react-checkbox @radix-ui/react-switch 
npm install @radix-ui/react-tabs @radix-ui/react-select

# TypeScript types
npm install --save-dev @types/jsonwebtoken @types/bcryptjs @types/qrcode
```

### Step 2: Set Environment Variables
Create `.env.local`:
```env
# Database (REQUIRED)
DATABASE_URL=postgresql://user:pass@host/db
POSTGRES_URL=postgresql://user:pass@host/db

# Security (REQUIRED - use strong secret)
JWT_SECRET=your-very-long-random-string-here

# Blob Storage (REQUIRED)
BLOB_READ_WRITE_TOKEN=vercel_blob_token_here

# Super Admin (Optional - defaults shown)
SUPER_ADMIN_EMAIL=super@careerly.com
SUPER_ADMIN_PASSWORD=super123
```

### Step 3: Run Database Migration
```bash
# Option A: Using psql directly
psql $DATABASE_URL < migrations/complete-careerly-schema.sql

# Option B: Using migration script
node scripts/run-migration.js
```

### Step 4: Verify Installation
```bash
# Build to check for TypeScript errors
npm run build

# Start development server
npm run dev
```

## 🧪 Testing the Complete System

### 1. Super Admin Setup
```
1. Visit: http://localhost:3000/super-admin/login
2. Login: super@careerly.com / super123
3. Create Organization:
   - Name: KNET
   - Slug: knet
   - Public: Yes
4. Click QR Code icon to generate
5. Copy student link
```

### 2. Student Submission
```
1. Visit: http://localhost:3000/knet/start
   (or scan the QR code)
2. Fill form:
   - Full Name: أحمد محمد
   - Email: ahmad@example.com
   - Phone: 9999 9999
   - Degree: Bachelor
   - Field: Computer Science
   - Area: Software Development
   - Experience: 2-3 years
   - GPA: 3.50 (optional)
   - Upload CV (PDF)
3. Submit
```

### 3. Admin Dashboard
```
1. Invite admin from Super Admin portal
2. Copy invite link
3. Set password
4. Login: http://localhost:3000/knet/admin/login
5. View candidates
6. Use filters
7. Export CSV/PDF
```

### 4. Verify Isolation
```
1. Create second org: NBK
2. Login to NBK admin
3. Try accessing /knet/admin
4. Should redirect (blocked)
```

## 📁 File Structure

```
careerly/
├── app/
│   ├── super-admin/           # Super admin portal
│   │   ├── login/
│   │   └── page.tsx           # Dashboard
│   ├── [org]/                 # Dynamic org routes
│   │   ├── start/
│   │   │   └── page.tsx       # Student form
│   │   └── admin/
│   │       ├── login/
│   │       └── page.tsx       # Admin dashboard
│   ├── api/
│   │   ├── super-admin/       # Super admin APIs
│   │   └── [org]/             # Org-scoped APIs
│   └── start/                 # Company picker
│       └── company-picker.tsx
├── components/
│   ├── watheefti-upload-form.tsx  # Student form
│   └── admin-dashboard.tsx        # Admin UI
├── lib/
│   ├── watheefti-fields.ts   # Kuwait field definitions
│   └── db.ts                  # Database connection
├── migrations/
│   └── complete-careerly-schema.sql
└── middleware.ts              # Auth & routing

```

## 🔐 Access URLs

### Platform Management
- Super Admin Login: `/super-admin/login`
- Super Admin Dashboard: `/super-admin`

### Organization Access
- Company Picker: `/start`
- Student Form: `/{org}/start` (e.g., `/knet/start`)
- Admin Login: `/{org}/admin/login`
- Admin Dashboard: `/{org}/admin`

## 🎯 Key Features

### For Super Admins
- ✅ Create unlimited organizations
- ✅ Toggle features per org (AI, exports, analytics)
- ✅ Generate QR codes for easy access
- ✅ Invite admins with secure tokens
- ✅ Full audit trail

### For Organizations
- ✅ Isolated data (no cross-org access)
- ✅ Custom branding (logos)
- ✅ Public or private access
- ✅ Per-org admin management
- ✅ Bulk operations

### For Students
- ✅ Watheefti-compliant forms
- ✅ Arabic/English support
- ✅ Mobile-friendly
- ✅ PDF upload (10MB max)
- ✅ Success confirmation

### For Admins
- ✅ Advanced filters
- ✅ Full-text search
- ✅ CSV/PDF export
- ✅ Bulk delete
- ✅ AI agent (if enabled)

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check tables exist
psql $DATABASE_URL -c "\dt"
```

### Build Errors
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

### Auth Issues
- Verify JWT_SECRET is set
- Check cookies in browser DevTools
- Review middleware logs
- Ensure organization exists

### Upload Issues
- Verify BLOB_READ_WRITE_TOKEN
- Check file size (<10MB)
- Ensure PDF format
- Check storage limits

## 📚 API Reference

### Super Admin APIs
```
POST   /api/super-admin/login
GET    /api/super-admin/verify
GET    /api/super-admin/organizations
POST   /api/super-admin/organizations
PATCH  /api/super-admin/organizations/:id/features
POST   /api/super-admin/organizations/:id/invite
```

### Organization APIs
```
POST   /api/{org}/submit          # Student submission
POST   /api/{org}/admin/login     # Admin auth
GET    /api/{org}/admin/candidates # List candidates
DELETE /api/{org}/admin/candidates/:id
POST   /api/{org}/admin/export/csv
POST   /api/{org}/admin/export/pdf
```

## 🎉 Ready to Deploy!

Your Careerly platform is now complete with:
- ✅ Super Admin control panel
- ✅ Multi-tenant isolation
- ✅ Watheefti compliance
- ✅ Full security implementation
- ✅ Production-ready code

**Next Steps:**
1. Deploy to Vercel
2. Configure production database
3. Set production environment variables
4. Create production super admin
5. Start onboarding Kuwait organizations!

---

**Built for Kuwait 🇰🇼** - Supporting all Kuwait organizations with enterprise-grade recruitment platform
