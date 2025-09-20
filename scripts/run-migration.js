const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Running multi-tenant migration...');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-org-fields-and-admin-users.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      await sql.query(statement);
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: node scripts/seed-admin.js');
    console.log('2. Visit: /start to see the company picker');
    console.log('3. Visit: /careerly/admin/login to test admin auth');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

runMigration();
