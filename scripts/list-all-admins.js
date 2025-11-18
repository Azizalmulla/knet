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

async function listAllAdmins() {
  try {
    const result = await sql`
      SELECT 
        o.slug as org_slug,
        o.name as org_name,
        au.email,
        au.role,
        au.last_login
      FROM admin_users au
      JOIN organizations o ON au.org_id = o.id
      ORDER BY o.slug ASC
    `;
    
    console.log('=== ALL ADMIN USERS ===\n');
    
    if (result.rows.length === 0) {
      console.log('❌ No admin users found');
    } else {
      console.log(`✅ Found ${result.rows.length} admin user(s)\n`);
      
      let currentOrg = '';
      result.rows.forEach(row => {
        if (row.org_slug !== currentOrg) {
          currentOrg = row.org_slug;
          console.log(`\n🏢 ${row.org_name} (${row.org_slug})`);
          console.log('─'.repeat(50));
        }
        console.log(`   📧 ${row.email}`);
        console.log(`   🔑 Role: ${row.role}`);
        console.log(`   🕐 Last login: ${row.last_login || 'Never'}`);
      });
      
      console.log('\n\n💡 All admins can login at: https://wathefni.ai/admin/login');
      console.log('💡 Default password for Test123! (if not changed)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

listAllAdmins();
