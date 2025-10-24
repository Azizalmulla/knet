// Run conversation memory migration
require('dotenv').config({ path: '.env.local' });

const { sql } = require('@vercel/postgres');
const fs = require('fs');
const path = require('path');

async function runConversationMigration() {
  console.log('🚀 Running conversation memory migration...\n');
  
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!dbUrl) {
    console.error('❌ No DATABASE_URL found in .env.local');
    process.exit(1);
  }
  
  try {
    // Test connection
    console.log('📡 Testing database connection...');
    await sql`SELECT 1`;
    console.log('✅ Connection successful!');
    
    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-conversation-memory.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log('\n📊 Creating conversation_sessions tables...');
    await sql.query(migrationSQL);
    console.log('✅ Migration completed successfully!');
    
    // Verify
    const check = await sql`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'conversation_sessions'
    `;
    
    if (check.rows[0].count > 0) {
      console.log('✅ conversation_sessions table created');
    }
    
    console.log('\n🎉 Done! The AI agent should work now.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\nError details:', error);
    process.exit(1);
  }
}

runConversationMigration();
