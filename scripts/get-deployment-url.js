#!/usr/bin/env node

const { execSync } = require('child_process')

function getDeploymentUrl() {
  console.log('🔍 Getting your Vercel deployment URL...')
  
  try {
    // Check if vercel CLI is installed
    try {
      execSync('vercel --version', { stdio: 'pipe' })
    } catch (error) {
      console.log('❌ Vercel CLI not found. Install with: npm i -g vercel')
      return
    }
    
    // Get the project info
    const projectInfo = execSync('vercel project ls --json', { encoding: 'utf8' })
    const projects = JSON.parse(projectInfo)
    
    if (projects.length === 0) {
      console.log('❌ No Vercel projects found. Run: vercel --prod to deploy first')
      return
    }
    
    // Get the current project (assuming it's the first one or matches current directory)
    const currentProject = projects[0]
    const projectName = currentProject.name
    
    // Get deployments for this project
    const deploymentsInfo = execSync(`vercel deployments list --json`, { encoding: 'utf8' })
    const deployments = JSON.parse(deploymentsInfo)
    
    // Find the most recent production deployment
    const prodDeployment = deployments.find(d => d.target === 'production' && d.state === 'READY')
    
    if (prodDeployment) {
      const deploymentUrl = `https://${prodDeployment.url}`
      console.log('✅ Found your production deployment URL:')
      console.log(`🌐 ${deploymentUrl}`)
      console.log('')
      console.log('📋 Use this URL for:')
      console.log(`1. NEXTAUTH_URL=${deploymentUrl}`)
      console.log(`2. Azure AD redirect URI: ${deploymentUrl}/api/auth/callback/microsoft-entra-id`)
      console.log(`3. Google OAuth redirect URI: ${deploymentUrl}/api/auth/callback/google`)
      
      return deploymentUrl
    } else {
      console.log('❌ No production deployment found. Deploy with: vercel --prod')
    }
    
  } catch (error) {
    console.error('❌ Error getting deployment info:', error.message)
    console.log('')
    console.log('💡 Manual steps:')
    console.log('1. Run: vercel --prod')
    console.log('2. Copy the deployment URL from the output')
    console.log('3. Use that URL for NEXTAUTH_URL in Vercel environment variables')
  }
}

getDeploymentUrl()
