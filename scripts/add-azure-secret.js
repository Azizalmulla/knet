#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function addAzureSecret() {
  console.log('🔐 Adding Azure AD client secret...')
  
  const envPath = path.join(process.cwd(), '.env.local')
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env.local file not found')
    return
  }
  
  console.log('📝 Please enter your Azure AD client secret value:')
  console.log('💡 Get it from: Azure Portal → App registrations → Careerly → Certificates & secrets')
  console.log('')
  console.log('⚠️  If you don\'t have it, create a new one and copy the value immediately!')
  console.log('')
  
  // Read current env file
  const envContent = fs.readFileSync(envPath, 'utf8')
  
  // Check if placeholder exists
  if (envContent.includes('<YOUR_AZURE_CLIENT_SECRET_VALUE>')) {
    console.log('✅ Found Azure secret placeholder in .env.local')
    console.log('')
    console.log('🔧 Manual step required:')
    console.log('1. Open .env.local in your editor')
    console.log('2. Replace <YOUR_AZURE_CLIENT_SECRET_VALUE> with your actual secret')
    console.log('3. Save the file')
    console.log('')
    console.log('Example:')
    console.log('AZURE_AD_CLIENT_SECRET=abc123def456...')
  } else if (envContent.includes('AZURE_AD_CLIENT_SECRET=')) {
    console.log('✅ Azure secret already configured in .env.local')
  } else {
    console.log('❌ Azure secret configuration not found in .env.local')
    console.log('💡 Run: node scripts/setup-nextauth-env.js first')
  }
}

addAzureSecret()
