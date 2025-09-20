const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function runCompleteMigration() {
  try {
    console.log('🚀 Running Complete Careerly Migration...\n');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', 'complete-careerly-schema.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration as a single transaction
    console.log('📊 Executing migration...');
    await sql.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify key tables exist
    console.log('🔍 Verifying database schema...');
    
    const tables = [
      'organizations',
      'super_admins', 
      'admin_users',
      'candidates',
      'watheefti_fields'
    ];
    
    for (const table of tables) {
      try {
        const result = await sql`
          SELECT COUNT(*) as count FROM ${sql.identifier([table])}
        `;
        console.log(`  ✓ Table '${table}' exists (${result.rows[0].count} rows)`);
      } catch (error) {
        console.log(`  ✗ Table '${table}' not found or error:`, error.message);
      }
    }
    
    // Check organizations
    const orgs = await sql`
      SELECT slug, name, is_public, enable_ai_builder, enable_exports 
      FROM organizations 
      WHERE deleted_at IS NULL
      ORDER BY name
    `;
    
    console.log(`\n🏢 Organizations created: ${orgs.rows.length}`);
    orgs.rows.forEach(org => {
      const flags = [];
      if (org.enable_ai_builder) flags.push('AI');
      if (org.enable_exports) flags.push('Exports');
      console.log(`  - ${org.name} (/${org.slug}) ${org.is_public ? '[Public]' : '[Private]'} [${flags.join(', ')}]`);
    });
    
    // Check super admin
    const superAdmins = await sql`
      SELECT email FROM super_admins
    `;
    
    console.log(`\n👑 Super Admins: ${superAdmins.rows.length}`);
    superAdmins.rows.forEach(admin => {
      console.log(`  - ${admin.email}`);
    });
    
    // Check Watheefti fields
    const fields = await sql`
      SELECT category, COUNT(*) as count 
      FROM watheefti_fields 
      GROUP BY category
      ORDER BY category
    `;
    
    console.log(`\n📋 Watheefti Fields:`);
    fields.rows.forEach(field => {
      console.log(`  - ${field.category}: ${field.count} options`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 Careerly Platform Ready!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start dev server: npm run dev');
    console.log('2. Super Admin: http://localhost:3000/super-admin/login');
    console.log('   - Email: super@careerly.com');
    console.log('   - Password: super123');
    console.log('3. Company Picker: http://localhost:3000/start');
    console.log('4. Test org: http://localhost:3000/knet/start');
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check DATABASE_URL is set correctly');
    console.error('2. Verify database connection');
    console.error('3. Check migration file exists');
    process.exit(1);
  }
  
  process.exit(0);
}

// Check for database connection
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
  console.error('❌ Database connection not configured.');
  console.error('\nPlease set DATABASE_URL or POSTGRES_URL environment variable.');
  console.error('\nTo configure:');
  console.error('1. Create .env.local file');
  console.error('2. Add: DATABASE_URL=your_neon_connection_string');
  console.error('3. Add: JWT_SECRET=your_secret_key');
  process.exit(1);
}

runCompleteMigration();
