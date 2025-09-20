# Vercel Environment Variables Setup

## Required NextAuth Environment Variables for Production

Go to your Vercel project → Settings → Environment Variables and add:

### Core NextAuth Configuration
```bash
# Replace with your actual Vercel deployment URL
NEXTAUTH_URL=https://cv-saas-azizalmulla16-gmailcoms-projects.vercel.app
NEXTAUTH_SECRET=Pu6SaxatMV57cKkzrq7YiSQYVVVN8lzp1Ef7gevwyCA=
```

**Important**: Replace the NEXTAUTH_URL with your actual Vercel deployment URL!

### Azure AD OAuth
```bash
AZURE_AD_CLIENT_ID=fe8844fb-fad5-4851-917b-5b0aff0ee865
AZURE_AD_CLIENT_SECRET=<your-actual-azure-client-secret>
AZURE_AD_TENANT_ID=e5a84a9f-ce02-42a0-8f29-0c076eacd3f9
```

### Email Provider (Resend)
```bash
RESEND_API_KEY=<your-existing-resend-key>
RESEND_FROM=noreply@careerly.app
```

### Optional: Google OAuth
```bash
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

## Azure AD Redirect URIs

Make sure these redirect URIs are configured in your Azure AD app:

**Development:**
- `http://localhost:3000/api/auth/callback/microsoft-entra-id`

**Production:**
- `https://cv-saas-azizalmulla16-gmailcoms-projects.vercel.app/api/auth/callback/microsoft-entra-id`

**Important**: 
1. Go to Azure Portal → App registrations → Careerly → Authentication
2. Add the production redirect URI above
3. Make sure both development and production URIs are listed

## Testing URLs

After deployment, test these URLs:

1. **Student Login**: `https://your-domain.vercel.app/student/login`
2. **Student Dashboard**: `https://your-domain.vercel.app/student/dashboard`
3. **NextAuth API**: `https://your-domain.vercel.app/api/auth/providers`

## Security Notes

- The `NEXTAUTH_SECRET` has been auto-generated with 32 bytes of entropy
- Keep all secrets secure and never commit them to version control
- Use different secrets for development and production
- Regularly rotate the `NEXTAUTH_SECRET` in production
