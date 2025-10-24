// Seed a sample org + candidate for CI/E2E
// Usage: node scripts/seed-ci-candidate.js [orgSlug]
// Requires DATABASE_URL

const { Pool } = require('pg')

async function main() {
  const orgSlug = process.argv[2] || process.env.E2E_ORG_SLUG || 'careerly'
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    console.error('Missing DATABASE_URL')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: dbUrl, ssl: dbUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined })

  try {
    // Ensure organization exists
    const orgRes = await pool.query(
      `INSERT INTO organizations (slug, name, is_public)
       VALUES ($1, $2, true)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id::uuid as id, slug`,
      [orgSlug, orgSlug.toUpperCase()]
    )
    const org = orgRes.rows[0]

    // Insert candidate with minimal fields
    const email = `e2e_${Date.now()}@example.com`
    const cvKey = process.env.CI_CV_BLOB_KEY || '' // optional
    const row = await pool.query(
      `INSERT INTO candidates (organization_id, full_name, email, phone, field_of_study, area_of_interest, cv_type, cv_blob_key, created_at, parse_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ai_generated', NULLIF($7,''), NOW(), 'done')
       RETURNING id::uuid as id, full_name, email`,
      [org.id, 'CI Test Candidate', email, '+965 1234 5678', 'Computer Science', 'Web Development', cvKey]
    )

    console.log(JSON.stringify({ ok: true, org_slug: org.slug, org_id: org.id, candidate_id: row.rows[0].id, email }))
    await pool.end()
  } catch (e) {
    console.error('Seed failed:', e.message || e)
    process.exit(1)
  }
}

main()
