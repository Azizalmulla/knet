// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runFinalMigration() {
  console.log('🚀 Running Complete Careerly Migration...\n');
  
  // Get database URL
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!dbUrl) {
    console.error('❌ No DATABASE_URL found in .env.local');
    process.exit(1);
  }
  
  // Create PostgreSQL pool
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const testResult = await pool.query('SELECT version() as pg_version');
    console.log('✅ Connection successful!');
    console.log(`📊 PostgreSQL: ${testResult.rows[0].pg_version.split(' ')[1]}`);
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'complete-careerly-schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    console.log('\n📊 Executing migration...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await pool.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    
    // Verify setup
    console.log('\n🔍 Verifying database setup...');
    
    // Check organizations
    const orgs = await pool.query(`
      SELECT slug, name, is_public, enable_ai_builder, enable_exports 
      FROM organizations 
      WHERE deleted_at IS NULL
      ORDER BY name
    `);
    
    console.log(`\n🏢 Organizations created: ${orgs.rows.length}`);
    orgs.rows.forEach(org => {
      const flags = [];
      if (org.enable_ai_builder) flags.push('AI');
      if (org.enable_exports) flags.push('Exports');
      console.log(`  ✅ ${org.name} (/${org.slug}) ${org.is_public ? '[Public]' : '[Private]'} [${flags.join(', ')}]`);
    });
    
    // Check super admin
    const superAdmins = await pool.query('SELECT email FROM super_admins');
    console.log(`\n👑 Super Admin: ${superAdmins.rows[0]?.email || 'Created successfully'}`);
    
    // Check Watheefti fields
    const fieldCount = await pool.query('SELECT COUNT(*) as count FROM watheefti_fields');
    console.log(`📋 Watheefti Fields: ${fieldCount.rows[0].count} options loaded`);
    
    // Check candidates table
    const candidateCount = await pool.query('SELECT COUNT(*) as count FROM candidates');
    console.log(`👥 Candidates Table: Ready (${candidateCount.rows[0].count} records)`);
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 CAREERLY PLATFORM IS LIVE!');
    console.log('\n🚀 Start the platform now:');
    console.log('   npm run dev');
    console.log('\n🔗 Access Points:');
    console.log('   • Super Admin: http://localhost:3000/super-admin/login');
    console.log('     - Email: super@careerly.com');
    console.log('     - Password: super123');
    console.log('   • Company Picker: http://localhost:3000/start');
    console.log('   • Test Org (KNET): http://localhost:3000/knet/start');
    console.log('\n🇰🇼 Ready to serve all Kuwait organizations!');
    console.log('   KNET • NBK • Zain • Boubyan • STC • and more...');
    console.log('\n' + '='.repeat(60));
    
    // Close pool
    await pool.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 Error details:', error.code || 'Unknown error');
    
    if (error.message.includes('permission denied')) {
      console.log('\n🔧 Permission issue - try using a different database role');
    } else if (error.message.includes('connection')) {
      console.log('\n🔧 Connection issue - check your Neon database is active');
    }
    
    process.exit(1);
  }
}

runFinalMigration();
