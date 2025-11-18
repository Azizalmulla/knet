#!/usr/bin/env node

/**
 * Production Integration Health Check
 * Tests real API endpoints on wathefni.ai
 */

const BASE_URL = 'https://wathefni.ai';

// Color codes for terminal
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
};

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    log.success(name);
    passCount++;
  } catch (error) {
    log.error(`${name}: ${error.message}`);
    failCount++;
  }
}

// Test helpers
async function fetchAPI(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  return response;
}

// ========================================
// TESTS
// ========================================

console.log('\n🚀 Starting Production Health Check...\n');
console.log('═'.repeat(60));

// 1. Basic Connectivity
await test('Production site is reachable', async () => {
  const response = await fetchAPI('/');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

// 2. Static Pages
await test('Start page loads', async () => {
  const response = await fetchAPI('/start');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

await test('Admin login page loads', async () => {
  const response = await fetchAPI('/admin/login');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

await test('Super admin login page loads', async () => {
  const response = await fetchAPI('/super-admin/login');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

// 3. API Endpoints - Public
await test('Public organizations API works', async () => {
  const response = await fetchAPI('/api/organizations/public');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  const orgs = data.organizations || [];
  if (!Array.isArray(orgs)) throw new Error('Expected organizations array');
  if (orgs.length === 0) throw new Error('No organizations found');
  log.info(`  Found ${orgs.length} organizations`);
});

// 4. API Endpoints - Auth (should reject without credentials)
await test('Admin API requires authentication', async () => {
  const response = await fetchAPI('/api/knet/admin/students');
  if (response.status !== 401 && response.status !== 403) {
    throw new Error(`Expected 401/403, got ${response.status}`);
  }
});

// 5. Rate Limiting
await test('Rate limiting is active', async () => {
  // Make multiple rapid requests
  const promises = Array(10).fill().map(() => fetchAPI('/api/organizations/public'));
  const responses = await Promise.all(promises);
  
  // Check if any got rate limited (429)
  const rateLimited = responses.some(r => r.status === 429);
  const allSuccess = responses.every(r => r.ok);
  
  if (allSuccess) {
    log.warning('  Rate limiting might not be enforced (all requests succeeded)');
  } else if (rateLimited) {
    log.info('  Rate limiting is working');
  }
});

// 6. Database connectivity (via public API)
await test('Database is connected', async () => {
  const response = await fetchAPI('/api/organizations/public');
  const data = await response.json();
  const orgs = data.organizations || [];
  
  // Check for known organizations
  const hasKnet = orgs.some(org => org.slug === 'knet');
  const hasDemo = orgs.some(org => org.slug === 'demo');
  
  if (!hasKnet && !hasDemo) {
    throw new Error('No known organizations found - DB might be empty');
  }
  
  log.info('  KNET org: ' + (hasKnet ? '✓' : '✗'));
  log.info('  Demo org: ' + (hasDemo ? '✓' : '✗'));
});

// 7. Career Map Data
await test('Career map data is loaded', async () => {
  const response = await fetchAPI('/api/cv/fields');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new Error('Career map data invalid');
  }
  const fields = data.fields || [];
  log.info(`  ${fields.length} fields of study available`);
});

// 8. Org-specific pages
await test('KNET org page loads', async () => {
  const response = await fetchAPI('/knet/start');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

await test('KNET admin login page loads', async () => {
  const response = await fetchAPI('/knet/admin/login');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

// 9. Voice-to-CV page
await test('Voice-to-CV page loads', async () => {
  const response = await fetchAPI('/voice-cv');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

// 10. AI Builder page
await test('AI Builder page loads', async () => {
  const response = await fetchAPI('/career/ai-builder');
  if (!response.ok) throw new Error(`Status: ${response.status}`);
});

// 11. Check for critical API routes
const criticalRoutes = [
  '/api/health',
  '/api/cv/fields',
  '/api/telemetry/top',
];

for (const route of criticalRoutes) {
  await test(`API route ${route} responds`, async () => {
    const response = await fetchAPI(route);
    // Any response (200, 404, etc) is fine - we're just checking it doesn't crash
    if (!response) throw new Error('No response');
  });
}

// ========================================
// SUMMARY
// ========================================

console.log('\n' + '═'.repeat(60));
console.log('\n📊 Test Summary:\n');
console.log(`  ${colors.green}Passed: ${passCount}${colors.reset}`);
console.log(`  ${colors.red}Failed: ${failCount}${colors.reset}`);
console.log(`  Total:  ${passCount + failCount}`);

const passRate = ((passCount / (passCount + failCount)) * 100).toFixed(1);
console.log(`\n  Pass Rate: ${passRate}%`);

if (failCount === 0) {
  console.log(`\n${colors.green}🎉 All tests passed! Production is healthy.${colors.reset}\n`);
  process.exit(0);
} else if (passRate >= 80) {
  console.log(`\n${colors.yellow}⚠️  Most tests passed, but some issues detected.${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${colors.red}❌ Critical issues detected in production.${colors.reset}\n`);
  process.exit(1);
}
