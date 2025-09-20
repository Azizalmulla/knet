// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { sql } = require('@vercel/postgres');

async function testConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  // Check if DATABASE_URL is set
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!dbUrl) {
    console.error('❌ No DATABASE_URL found in .env.local');
    console.log('\n💡 Please update .env.local with your Neon connection string');
    process.exit(1);
  }
  
  // Check if it's still the template URL
  if (dbUrl.includes('user:pass@host/db')) {
    console.error('❌ DATABASE_URL still contains template values');
    console.log('\n💡 Please replace with your actual Neon database URL:');
    console.log('   Format: postgresql://username:password@ep-abc-123.region.aws.neon.tech/dbname');
    process.exit(1);
  }
  
  try {
    console.log('📡 Attempting to connect to database...');
    console.log(`🔗 Host: ${new URL(dbUrl).hostname}`);
    
    const result = await sql`SELECT 1 as test, version() as pg_version`;
    
    console.log('✅ Database connection successful!');
    console.log(`📊 PostgreSQL Version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
    
    // Check if tables exist
    console.log('\n🔍 Checking existing tables...');
    try {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      
      if (tables.rows.length > 0) {
        console.log('📋 Existing tables:');
        tables.rows.forEach(row => {
          console.log(`  - ${row.table_name}`);
        });
        console.log('\n⚠️  Tables already exist. Migration will update schema safely.');
      } else {
        console.log('📭 No tables found - ready for fresh migration');
      }
    } catch (error) {
      console.log('ℹ️  Could not check tables (this is okay for first setup)');
    }
    
    console.log('\n✅ Database is ready for Careerly migration!');
    console.log('\n🚀 Running migration now...');
    
    return true;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your DATABASE_URL in .env.local');
    console.log('2. Ensure your Neon database is running');
    console.log('3. Verify the connection string format');
    console.log('4. Make sure you copied the full connection string');
    console.log('\n💡 Connection string should look like:');
    console.log('   postgresql://username:password@ep-abc-123.region.aws.neon.tech/dbname');
    process.exit(1);
  }
}

testConnection();
