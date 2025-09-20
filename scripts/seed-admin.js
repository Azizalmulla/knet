const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  try {
    const orgSlug = process.env.SEED_ADMIN_ORG_SLUG || 'careerly';
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@careerly.com';
    const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMeNow!';

    // Get target org
    const orgResult = await sql`
      SELECT id FROM organizations WHERE slug = ${orgSlug} LIMIT 1
    `;
    
    if (!orgResult.rows.length) {
      console.error(`Organization not found for slug: ${orgSlug}. Please run migrations and create the org first.`);
      process.exit(1);
    }
    
    const orgId = orgResult.rows[0].id;
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Insert admin user
    await sql`
      INSERT INTO admin_users (org_id, email, password_hash, role)
      VALUES (${orgId}::uuid, ${email}, ${passwordHash}, 'admin')
      ON CONFLICT (org_id, email_lc) 
      DO UPDATE SET password_hash = EXCLUDED.password_hash
    `;
    
    console.log(`Admin user created for org '${orgSlug}':`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`\nYou can now login at: /${orgSlug}/admin/login`);
    
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

seedAdmin();
