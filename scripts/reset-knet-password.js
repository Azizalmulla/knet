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
const bcrypt = require('bcryptjs');

async function resetKnetPassword() {
  try {
    const email = 'admin@knet.com';
    const newPassword = 'Test123!';
    
    console.log('Resetting password for:', email);
    console.log('New password:', newPassword);
    console.log('');
    
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    
    // Update the password
    const result = await sql`
      UPDATE admin_users
      SET password_hash = ${passwordHash}
      WHERE email_lc = ${email.toLowerCase()}
      RETURNING email, role
    `;
    
    if (result.rows.length === 0) {
      console.log('❌ Admin not found');
      process.exit(1);
    }
    
    console.log('✅ Password reset successfully!');
    console.log('');
    console.log('📧 Email:', result.rows[0].email);
    console.log('🔑 Password:', newPassword);
    console.log('');
    console.log('🚀 Try logging in at: https://wathefni.ai/admin/login');
    console.log('   OR: https://wathefni.ai/knet/admin/login');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetKnetPassword();
