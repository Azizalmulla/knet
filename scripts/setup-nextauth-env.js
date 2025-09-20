#!/usr/bin/env node

const fs = require('fs')
const crypto = require('crypto')
const path = require('path')

function generateSecret() {
  return crypto.randomBytes(32).toString('base64')
}

function setupNextAuthEnv() {
  console.log('🔐 Setting up NextAuth environment variables...')
  
  const envPath = path.join(process.cwd(), '.env.local')
  
  // Generate a secure secret
  const nextAuthSecret = generateSecret()
  
  // NextAuth environment variables to add
  const nextAuthVars = `
# NextAuth Configuration (Student Authentication)
# For development - use localhost
# NEXTAUTH_URL=http://localhost:3000
# For production - use your actual domain
NEXTAUTH_URL=https://your-vercel-app.vercel.app
NEXTAUTH_SECRET=${nextAuthSecret}

# Azure AD OAuth (from your Azure portal)
AZURE_AD_CLIENT_ID=fe8844fb-fad5-4851-917b-5b0aff0ee865
AZURE_AD_CLIENT_SECRET=<YOUR_AZURE_CLIENT_SECRET_VALUE>
AZURE_AD_TENANT_ID=e5a84a9f-ce02-42a0-8f29-0c076eacd3f9

# Google OAuth (optional - set up in Google Cloud Console)
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Provider (using existing Resend)
# RESEND_API_KEY=<already-configured>
# RESEND_FROM=noreply@careerly.app
`

  try {
    // Read existing .env.local
    let existingEnv = ''
    if (fs.existsSync(envPath)) {
      existingEnv = fs.readFileSync(envPath, 'utf8')
      console.log('📝 Found existing .env.local file')
    } else {
      console.log('📝 Creating new .env.local file')
    }
    
    // Check if NextAuth vars already exist
    if (existingEnv.includes('NEXTAUTH_URL')) {
      console.log('⚠️  NextAuth variables already exist in .env.local')
      console.log('🔑 Generated NEXTAUTH_SECRET:', nextAuthSecret)
      console.log('\n📋 Manual setup required:')
      console.log('1. Replace NEXTAUTH_SECRET with the generated value above')
      console.log('2. Add your Azure AD client secret value')
      console.log('3. Optionally add Google OAuth credentials')
      return
    }
    
    // Append NextAuth variables
    const updatedEnv = existingEnv + nextAuthVars
    fs.writeFileSync(envPath, updatedEnv)
    
    console.log('✅ NextAuth environment variables added to .env.local')
    console.log('\n🔧 Manual steps required:')
    console.log('1. Replace <YOUR_AZURE_CLIENT_SECRET_VALUE> with your actual Azure AD client secret')
    console.log('2. For production, update NEXTAUTH_URL to your domain')
    console.log('3. Add Google OAuth credentials if needed')
    
    console.log('\n🔑 Generated NEXTAUTH_SECRET:', nextAuthSecret)
    console.log('💡 This secret is already added to your .env.local file')
    
  } catch (error) {
    console.error('❌ Error setting up environment:', error.message)
    console.log('\n📋 Manual setup required - add these to your .env.local:')
    console.log(nextAuthVars)
  }
}

setupNextAuthEnv()
