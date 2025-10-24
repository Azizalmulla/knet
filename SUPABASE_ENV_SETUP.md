# Supabase Environment Variables Setup

## Add these to your .env.local file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://azmrfxzhutnxgbxgyjbe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6bXJmeHpodXRueGdieGd5amJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NTA1ODcsImV4cCI6MjA3NDAyNjU4N30.yzwV0jw1yu0lAVYP_UbklX3CxHj4VBSciEK5TdIA0h8
```

## Also add these to Vercel Environment Variables:

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add the same two variables above
4. Deploy your application

## Supabase Dashboard Configuration

Make sure you have configured the following in your Supabase dashboard:

1. **Authentication > URL Configuration:**
   - Site URL: `https://cv-saas-phi.vercel.app`
   - Redirect URLs:
     - `https://cv-saas-phi.vercel.app/*`
     - `http://localhost:3000/*`
     - `https://*.vercel.app/*` (for preview deployments)

2. **Authentication > Providers:**
   - Google OAuth enabled
   - Microsoft Azure AD enabled
   - Email/Magic Link enabled

## Testing

After adding the environment variables:

1. Run locally: `npm run dev`
2. Navigate to: `http://localhost:3000/student/login`
3. Try signing in with Google, Microsoft, or Email

## Note

The old NextAuth environment variables are no longer needed and can be removed:
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- AZURE_AD_CLIENT_ID
- AZURE_AD_CLIENT_SECRET
- AZURE_AD_TENANT_ID
