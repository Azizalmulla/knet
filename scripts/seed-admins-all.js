// Ensure @vercel/postgres uses the same connection as other routes
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL;
}
const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

(async function main() {
  try {
    const password = process.env.SEED_ADMIN_PASSWORD || 'Test123!';
    const role = process.env.SEED_ADMIN_ROLE || 'admin';

    // Detect admin_users FK column name and type (organization_id vs org_id)
    const fkColCheck = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_users'
        AND column_name IN ('organization_id','org_id')
      ORDER BY (CASE WHEN column_name = 'organization_id' THEN 0 ELSE 1 END)
      LIMIT 1
    `;
    if (!fkColCheck.rows.length) {
      console.error("admin_users table not found or missing org reference column (organization_id/org_id). Run migrations first.");
      process.exit(1);
    }
    const fkCol = fkColCheck.rows[0].column_name;
    const fkType = fkColCheck.rows[0].data_type; // 'uuid' or 'integer'
    const needsUuidCast = fkType === 'uuid';

    // Fetch all public, non-archived orgs. Select id as text to support either schema
    const { rows: orgs } = await sql`
      SELECT id::text as id, slug
      FROM organizations
      WHERE COALESCE(is_public, true) = true
        AND slug IS NOT NULL
        AND slug NOT LIKE 'deleted-%'
      ORDER BY slug ASC
    `;

    if (!orgs.length) {
      console.error('No public organizations found to seed.');
      process.exit(1);
    }

    console.log(`Seeding admin users for ${orgs.length} organization(s)...`);
    const hash = await bcrypt.hash(password, 12);

    for (const org of orgs) {
      const email = `admin@${org.slug}.com`;
      const col = fkCol;
      const cast = needsUuidCast ? '::uuid' : '';
      const text = `INSERT INTO admin_users (${col}, email, password_hash, role)
        VALUES ($1${cast}, $2, $3, $4)
        ON CONFLICT (${col}, email_lc)
        DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`;
      await sql.query(text, [org.id, email, hash, role]);
      console.log(`  ✓ ${org.slug}: ${email} / ${password}`);
    }

    console.log('\nLogin URLs:');
    for (const org of orgs) {
      console.log(`  /${org.slug}/admin/login`);
    }

    console.log('\nDone.');
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e?.message || e);
    process.exit(1);
  }
})();
