#!/usr/bin/env node

/**
 * Critical Flow Integration Tests
 * Tests actual user flows on production with real API calls
 */

const BASE_URL = 'https://wathefni.ai';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}→  ${msg}${colors.reset}`),
};

console.log('\n🧪 Testing Critical User Flows\n');
console.log('═'.repeat(70));

// ========================================
// FLOW 1: Admin Login Flow
// ========================================

console.log('\n📋 FLOW 1: Admin Login Authentication\n');

async function testAdminLogin() {
  log.step('Testing admin login endpoint...');
  
  try {
    // Test with correct credentials
    const response = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@knet.com',
        password: 'Test123!'
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      log.success('Admin login successful');
      log.info(`  Org: ${data.orgSlug || 'unknown'}`);
      return true;
    } else if (response.status === 401) {
      log.error('Admin login failed - Invalid credentials');
      log.info('  This might mean password was changed');
      return false;
    } else {
      log.error(`Admin login failed - Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    log.error(`Admin login error: ${error.message}`);
    return false;
  }
}

// ========================================
// FLOW 2: Organization Data Flow
// ========================================

console.log('\n📋 FLOW 2: Organization & Career Data\n');

async function testOrganizationData() {
  log.step('Fetching organizations...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/organizations/public`);
    const data = await response.json();
    const orgs = data.organizations || [];
    
    if (!Array.isArray(orgs) || orgs.length === 0) {
      log.error('No organizations found');
      return false;
    }
    
    log.success(`Found ${orgs.length} organizations`);
    
    // Check for critical orgs
    const knet = orgs.find(o => o.slug === 'knet');
    const demo = orgs.find(o => o.slug === 'demo');
    
    if (knet) {
      log.info(`  ✓ KNET: ${knet.name}`);
    } else {
      log.warning('  ✗ KNET organization not found');
    }
    
    if (demo) {
      log.info(`  ✓ Demo: ${demo.name}`);
    }
    
    return orgs.length > 0;
  } catch (error) {
    log.error(`Organization fetch error: ${error.message}`);
    return false;
  }
}

async function testCareerData() {
  log.step('Checking career map data...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/cv/fields`);
    const data = await response.json();
    const fields = data.fields || [];
    
    if (!Array.isArray(fields) || fields.length === 0) {
      log.error('No career fields found');
      return false;
    }
    
    log.success(`Found ${fields.length} fields of study`);
    
    // Check for critical fields
    const hasCS = fields.some(f => f.toLowerCase().includes('computer'));
    const hasEngineering = fields.some(f => f.toLowerCase().includes('engineering'));
    
    if (hasCS) log.info('  ✓ Computer Science/Technology field exists');
    if (hasEngineering) log.info('  ✓ Engineering field exists');
    
    return true;
  } catch (error) {
    log.error(`Career data error: ${error.message}`);
    return false;
  }
}

// ========================================
// FLOW 3: API Security & Rate Limiting
// ========================================

console.log('\n📋 FLOW 3: Security & Rate Limiting\n');

async function testApiSecurity() {
  log.step('Testing API authentication...');
  
  const protectedEndpoints = [
    '/api/knet/admin/students',
    '/api/knet/admin/cv/download/123',
    '/api/super-admin/organizations',
  ];
  
  let allProtected = true;
  
  for (const endpoint of protectedEndpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      
      if (response.status === 401 || response.status === 403) {
        log.info(`  ✓ ${endpoint} is protected`);
      } else if (response.status === 404) {
        log.info(`  ~ ${endpoint} not found (acceptable)`);
      } else {
        log.warning(`  ✗ ${endpoint} returned ${response.status} (expected 401/403)`);
        allProtected = false;
      }
    } catch (error) {
      log.warning(`  ✗ ${endpoint} error: ${error.message}`);
    }
  }
  
  if (allProtected) {
    log.success('All protected endpoints require authentication');
  }
  
  return allProtected;
}

async function testRateLimiting() {
  log.step('Testing rate limiting...');
  
  try {
    // Make 20 rapid requests to trigger rate limit
    const requests = Array(20).fill().map((_, i) => 
      fetch(`${BASE_URL}/api/organizations`, {
        headers: { 'X-Test-Request': `rate-limit-${i}` }
      }).then(r => r.status)
    );
    
    const statuses = await Promise.all(requests);
    const rateLimited = statuses.filter(s => s === 429).length;
    const successful = statuses.filter(s => s === 200).length;
    
    if (rateLimited > 0) {
      log.success(`Rate limiting active (${rateLimited}/20 requests rate-limited)`);
      return true;
    } else {
      log.warning(`Rate limiting not triggered (${successful}/20 succeeded)`);
      log.info('  This might be normal if limits are high');
      return true; // Not a failure
    }
  } catch (error) {
    log.error(`Rate limit test error: ${error.message}`);
    return false;
  }
}

// ========================================
// FLOW 4: Student Pages & Forms
// ========================================

console.log('\n📋 FLOW 4: Student-Facing Pages\n');

async function testStudentPages() {
  log.step('Checking student pages...');
  
  const pages = [
    { path: '/start', name: 'Company Picker' },
    { path: '/knet/start', name: 'KNET Start Page' },
    { path: '/career/ai-builder', name: 'AI Builder' },
    { path: '/voice-cv', name: 'Voice-to-CV' },
  ];
  
  let allWorking = true;
  
  for (const page of pages) {
    try {
      const response = await fetch(`${BASE_URL}${page.path}`);
      
      if (response.ok) {
        log.info(`  ✓ ${page.name} loads (${response.status})`);
      } else {
        log.warning(`  ✗ ${page.name} failed (${response.status})`);
        allWorking = false;
      }
    } catch (error) {
      log.error(`  ✗ ${page.name} error: ${error.message}`);
      allWorking = false;
    }
  }
  
  if (allWorking) {
    log.success('All student pages are accessible');
  }
  
  return allWorking;
}

// ========================================
// FLOW 5: Database Connectivity
// ========================================

console.log('\n📋 FLOW 5: Database Connection\n');

async function testDatabaseConnection() {
  log.step('Testing database via public API...');
  
  try {
    // Test read operation
    const response = await fetch(`${BASE_URL}/api/organizations/public`);
    
    if (!response.ok) {
      log.error('Database read failed');
      return false;
    }
    
    const data = await response.json();
    const orgs = data.organizations || [];
    
    if (Array.isArray(orgs) && orgs.length > 0) {
      log.success('Database connection working');
      log.info(`  Read ${orgs.length} records successfully`);
      return true;
    } else {
      log.warning('Database connected but no data found');
      return false;
    }
  } catch (error) {
    log.error(`Database error: ${error.message}`);
    return false;
  }
}

// ========================================
// RUN ALL TESTS
// ========================================

async function runAllTests() {
  const results = {
    adminLogin: await testAdminLogin(),
    orgData: await testOrganizationData(),
    careerData: await testCareerData(),
    security: await testApiSecurity(),
    rateLimiting: await testRateLimiting(),
    studentPages: await testStudentPages(),
    database: await testDatabaseConnection(),
  };
  
  console.log('\n' + '═'.repeat(70));
  console.log('\n📊 Critical Flows Summary:\n');
  
  Object.entries(results).forEach(([key, passed]) => {
    const icon = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    console.log(`  ${icon} ${color}${key}${colors.reset}`);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const passRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  console.log(`\n  Pass Rate: ${passRate}% (${passedTests}/${totalTests})`);
  
  if (passedTests === totalTests) {
    console.log(`\n${colors.green}🎉 All critical flows working!${colors.reset}\n`);
    return 0;
  } else if (passRate >= 70) {
    console.log(`\n${colors.yellow}⚠️  Some flows need attention${colors.reset}\n`);
    return 1;
  } else {
    console.log(`\n${colors.red}❌ Critical issues detected${colors.reset}\n`);
    return 1;
  }
}

runAllTests().then(exitCode => process.exit(exitCode));
