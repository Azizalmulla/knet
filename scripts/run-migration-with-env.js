// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function runMigrationWithEnv() {
  console.log('🚀 Running Complete Careerly Migration...\n');
  
  // Check database URL
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!dbUrl) {
    console.error('❌ No DATABASE_URL found in .env.local');
    console.log('\n💡 Please update .env.local with your Neon connection string');
    process.exit(1);
  }
  
  if (dbUrl.includes('user:pass@host/db')) {
    console.error('❌ DATABASE_URL still contains template values');
    console.log('\n📝 To fix this:');
    console.log('1. Open .env.local file');
    console.log('2. Replace the first line:');
    console.log('   FROM: DATABASE_URL=postgresql://user:pass@host/db');
    console.log('   TO:   DATABASE_URL=your_actual_neon_connection_string');
    console.log('\n💡 Your Neon connection string should look like:');
    console.log('   postgresql://username:password@ep-abc-123.region.aws.neon.tech/dbname');
    console.log('\n🔗 Get it from: https://console.neon.tech → Your Project → Connection Details');
    process.exit(1);
  }
  
  try {
    // Test connection first
    console.log('📡 Testing database connection...');
    const testResult = await sql`SELECT version() as pg_version`;
    console.log('✅ Connection successful!');
    console.log(`📊 PostgreSQL: ${testResult.rows[0].pg_version.split(' ')[1]}`);
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'complete-careerly-schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('\n📊 Executing migration...');
    await sql.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    
    // Verify setup
    console.log('\n🔍 Verifying database setup...');
    
    // Check organizations
    const orgs = await sql`
      SELECT slug, name, is_public, enable_ai_builder, enable_exports 
      FROM organizations 
      WHERE deleted_at IS NULL
      ORDER BY name
    `;
    
    console.log(`\n🏢 Organizations: ${orgs.rows.length}`);
    orgs.rows.forEach(org => {
      const flags = [];
      if (org.enable_ai_builder) flags.push('AI');
      if (org.enable_exports) flags.push('Exports');
      console.log(`  ✅ ${org.name} (/${org.slug}) ${org.is_public ? '[Public]' : '[Private]'} [${flags.join(', ')}]`);
    });
    
    // Check super admin
    const superAdmins = await sql`SELECT email FROM super_admins`;
    console.log(`\n👑 Super Admin: ${superAdmins.rows[0]?.email || 'super@careerly.com'}`);
    
    // Check Watheefti fields
    const fieldCount = await sql`SELECT COUNT(*) as count FROM watheefti_fields`;
    console.log(`📋 Watheefti Fields: ${fieldCount.rows[0].count} loaded`);
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 CAREERLY PLATFORM IS READY!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start server: npm run dev');
    console.log('2. Super Admin: http://localhost:3000/super-admin/login');
    console.log('   - Email: super@careerly.com');
    console.log('   - Password: super123');
    console.log('3. Company Picker: http://localhost:3000/start');
    console.log('4. Test Organization: http://localhost:3000/knet/start');
    console.log('\n🇰🇼 Ready to serve all Kuwait organizations!');
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify your DATABASE_URL is correct');
    console.log('2. Check database permissions');
    console.log('3. Ensure network connectivity');
    process.exit(1);
  }
}

runMigrationWithEnv();
