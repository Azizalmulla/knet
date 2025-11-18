// Load env vars from .env.local
const fs = require('fs');
const path = require('path');
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  });
} catch (e) {
  console.warn('Could not load .env.local, using existing env vars');
}

const { sql } = require('@vercel/postgres');

async function checkKnetAdmin() {
  try {
    // Check if KNET admin exists
    const result = await sql`
      SELECT 
        au.email,
        au.email_lc,
        au.role,
        o.slug as org_slug,
        o.name as org_name
      FROM admin_users au
      JOIN organizations o ON au.org_id = o.id
      WHERE o.slug = 'knet'
      LIMIT 5
    `;
    
    console.log('=== KNET Admin Users ===');
    if (result.rows.length === 0) {
      console.log('❌ No admin users found for KNET');
      console.log('\nRun: npm run seed:admin to create one');
    } else {
      console.log('✅ Found KNET admin users:');
      result.rows.forEach(row => {
        console.log(`  Email: ${row.email}`);
        console.log(`  Email (lowercase): ${row.email_lc}`);
        console.log(`  Role: ${row.role}`);
        console.log(`  Org: ${row.org_name} (${row.org_slug})`);
        console.log('  ---');
      });
      console.log('\n💡 Password should be: Test123!');
      console.log('💡 Try logging in at: https://wathefni.ai/admin/login');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkKnetAdmin();
