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
const bcrypt = require('bcryptjs');

async function testLogin() {
  try {
    const email = 'admin@knet.com';
    const password = 'Test123!';
    
    console.log('Testing login for:', email);
    console.log('Password:', password);
    console.log('');
    
    // Detect column name
    const colCheckRes = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users'
        AND column_name IN ('organization_id','org_id')
    `;
    const cols = colCheckRes.rows.map(r => r.column_name);
    const adminUsersOrgCol = cols.includes('organization_id') ? 'organization_id' : 'org_id';
    console.log('📋 Admin users column name:', adminUsersOrgCol);
    console.log('');
    
    // Query admin
    const query = `
      SELECT 
        au.id::text            AS admin_id,
        au.password_hash       AS password_hash,
        au.role                AS role,
        au.email               AS admin_email,
        au.email_lc            AS email_lc,
        org.id::text           AS org_id,
        org.slug               AS org_slug,
        org.name               AS org_name
      FROM admin_users au
      JOIN organizations org ON au.${adminUsersOrgCol} = org.id
      WHERE au.email_lc = $1
      LIMIT 25
    `;
    console.log('🔍 Searching with email_lc:', email.toLowerCase());
    const result = await sql.query(query, [email.toLowerCase()]);
    
    if (!result.rows.length) {
      console.log('❌ No admin found with that email');
      process.exit(1);
    }
    
    console.log(`✅ Found ${result.rows.length} admin(s)`);
    console.log('');
    
    // Test password
    for (const row of result.rows) {
      console.log(`Testing org: ${row.org_name} (${row.org_slug})`);
      console.log(`  Email: ${row.admin_email}`);
      console.log(`  Email (lowercase): ${row.email_lc}`);
      
      const isValid = await bcrypt.compare(password, row.password_hash);
      console.log(`  Password match: ${isValid ? '✅ YES' : '❌ NO'}`);
      
      if (isValid) {
        console.log('');
        console.log('🎉 LOGIN WOULD SUCCEED!');
        console.log(`   Redirect to: /${row.org_slug}/admin`);
      }
      console.log('');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testLogin();
