const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Running Enhanced Per-Org Admin Authentication Migration...\n');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', 'enhanced-org-admin-auth.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    // Filter out comments and empty statements
    const statements = migrationSQL
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    
    for (const statement of statements) {
      // Skip empty statements or comments
      if (!statement || statement.startsWith('--')) continue;
      
      try {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await sql.query(statement);
        successCount++;
      } catch (error) {
        // Handle DO blocks and other special statements
        if (error.message.includes('DO')) {
          console.log('  Skipping DO block (manual execution required)');
        } else {
          console.error(`  Warning: ${error.message}`);
        }
      }
    }
    
    console.log(`\n✅ Migration completed! ${successCount} statements executed successfully.`);
    
    // Verify tables exist
    console.log('\n📊 Verifying database schema...');
    
    const tables = [
      'organizations',
      'admin_users', 
      'admin_sessions',
      'agent_audit'
    ];
    
    for (const table of tables) {
      try {
        const result = await sql`
          SELECT COUNT(*) FROM ${sql.identifier([table])} LIMIT 1
        `;
        console.log(`  ✓ Table '${table}' exists`);
      } catch (error) {
        console.log(`  ✗ Table '${table}' not found`);
      }
    }
    
    // Check sample organizations
    const orgs = await sql`
      SELECT slug, name, is_public FROM organizations ORDER BY name
    `;
    
    console.log(`\n🏢 Organizations in database: ${orgs.rows.length}`);
    orgs.rows.forEach(org => {
      console.log(`  - ${org.name} (${org.slug}) ${org.is_public ? '[Public]' : '[Private]'}`);
    });
    
    console.log('\n' + '=' .repeat(50));
    console.log('\n📋 Next Steps:');
    console.log('1. Run seed script: node scripts/seed-admin.ts');
    console.log('2. Start dev server: npm run dev');
    console.log('3. Visit company picker: http://localhost:3000/start');
    console.log('4. Test admin login: http://localhost:3000/{org}/admin/login');
    console.log('\n' + '=' .repeat(50));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Check for database connection
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('❌ Database connection not configured.');
  console.error('Please set DATABASE_URL or POSTGRES_URL environment variable.');
  console.error('\nTo configure:');
  console.error('1. Create .env.local file');
  console.error('2. Add: DATABASE_URL=your_neon_connection_string');
  process.exit(1);
}

runMigration();
