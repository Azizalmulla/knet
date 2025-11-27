// Check if interview scheduling tables exist
const { sql } = require('@vercel/postgres');

async function checkTables() {
  try {
    console.log('Checking for interview scheduling tables...\n');
    
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('interview_availability', 'interview_bookings', 'admin_scheduling_preferences')
      ORDER BY table_name
    `;
    
    const found = result.rows.map(r => r.table_name);
    const required = ['admin_scheduling_preferences', 'interview_availability', 'interview_bookings'];
    
    console.log('Required tables:', required.join(', '));
    console.log('Found tables:', found.length > 0 ? found.join(', ') : '(none)');
    console.log('');
    
    if (found.length === 0) {
      console.log('❌ NO schedule tables found');
      console.log('');
      console.log('To fix, run this migration in Neon console:');
      console.log('  migrations/add-interview-scheduling.sql');
    } else if (found.length === 3) {
      console.log('✅ All schedule tables exist! Feature should work.');
      
      // Check if any slots exist
      const slots = await sql`SELECT COUNT(*) as count FROM interview_availability`;
      console.log(`   - ${slots.rows[0].count} availability slots in database`);
    } else {
      console.log(`⚠️ Partial setup - only ${found.length}/3 tables found`);
      const missing = required.filter(t => !found.includes(t));
      console.log('   Missing:', missing.join(', '));
    }
    
  } catch (e) {
    console.error('Error:', e.message);
    if (e.message.includes('does not exist')) {
      console.log('\n❌ Table does not exist - migration needed');
    }
  }
  process.exit(0);
}

checkTables();
