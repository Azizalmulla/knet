const { sql } = require('@vercel/postgres');

async function testConnection() {
  console.log('🔍 Testing Database Connection...\n');
  
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.error('❌ No DATABASE_URL found in environment');
    console.log('\n💡 Make sure you have updated .env.local with your Neon connection string');
    process.exit(1);
  }
  
  try {
    console.log('📡 Attempting to connect...');
    const result = await sql`SELECT 1 as test, version() as pg_version`;
    
    console.log('✅ Database connection successful!');
    console.log(`📊 PostgreSQL Version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
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
      } else {
        console.log('📭 No tables found - ready for fresh migration');
      }
    } catch (error) {
      console.log('ℹ️  Could not check tables (this is okay for first setup)');
    }
    
    console.log('\n✅ Database is ready for Careerly migration!');
    console.log('\n🚀 Next step: node scripts/run-complete-migration.js');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your DATABASE_URL in .env.local');
    console.log('2. Ensure your Neon database is running');
    console.log('3. Verify the connection string format');
    console.log('4. Check network connectivity');
    process.exit(1);
  }
}

testConnection();
