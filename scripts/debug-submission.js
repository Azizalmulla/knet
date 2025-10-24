#!/usr/bin/env node
/**
 * Debug why CV submissions aren't appearing
 * Run: node scripts/debug-submission.js <email>
 */

const { Client } = require('pg')

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: node scripts/debug-submission.js <email>')
    console.error('Example: node scripts/debug-submission.js user@example.com')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or POSTGRES_URL')
    process.exit(1)
  }

  const ssl = (dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require'))
    ? { rejectUnauthorized: false }
    : undefined
  const client = new Client({ connectionString: dbUrl, ssl })

  await client.connect()
  console.log('✓ Connected to database\n')

  try {
    // 1. Check if organizations table has required columns
    console.log('1. Checking organizations schema...')
    const orgCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      AND column_name IN ('is_public', 'deleted_at')
    `)
    const hasCols = orgCols.rows.map(r => r.column_name)
    console.log('   Found columns:', hasCols.length ? hasCols.join(', ') : 'NONE (OK - will use fallback)')

    // 2. Check organizations exist
    console.log('\n2. Checking organizations...')
    const orgs = await client.query('SELECT id, slug, name FROM organizations LIMIT 5')
    if (orgs.rows.length === 0) {
      console.log('   ❌ NO ORGANIZATIONS FOUND')
      console.log('   This would block submissions. Run: POST /api/admin/migrate')
    } else {
      console.log(`   ✓ Found ${orgs.rows.length} org(s):`)
      orgs.rows.forEach(r => console.log(`     - ${r.slug} (${r.name})`))
    }

    // 3. Check candidates for this email
    console.log(`\n3. Checking candidates for email: ${email}`)
    const candidates = await client.query(`
      SELECT 
        c.id::text,
        c.full_name,
        c.email,
        c.org_id::text,
        o.slug as org_slug,
        o.name as org_name,
        c.parse_status::text,
        c.created_at,
        c.deleted_at
      FROM candidates c
      LEFT JOIN organizations o ON o.id = c.org_id
      WHERE LOWER(c.email) = LOWER($1)
      ORDER BY c.created_at DESC
      LIMIT 10
    `, [email])

    if (candidates.rows.length === 0) {
      console.log('   ❌ NO CANDIDATES FOUND for this email')
      console.log('   → Submit is either failing silently or using a different email')
    } else {
      console.log(`   ✓ Found ${candidates.rows.length} candidate(s):`)
      candidates.rows.forEach(r => {
        console.log(`     - ID: ${r.id}`)
        console.log(`       Org: ${r.org_slug} (${r.org_name})`)
        console.log(`       Name: ${r.full_name}`)
        console.log(`       Status: ${r.parse_status}`)
        console.log(`       Created: ${r.created_at}`)
        console.log(`       Deleted: ${r.deleted_at || 'No'}`)
        console.log('')
      })
    }

    // 4. Check enums exist
    console.log('4. Checking required enums...')
    const enums = await client.query(`
      SELECT typname 
      FROM pg_type 
      WHERE typname IN ('yoe_bucket', 'cv_type_enum', 'parse_status_enum')
    `)
    const foundEnums = enums.rows.map(r => r.typname)
    const requiredEnums = ['yoe_bucket', 'cv_type_enum', 'parse_status_enum']
    const missingEnums = requiredEnums.filter(e => !foundEnums.includes(e))
    if (missingEnums.length) {
      console.log(`   ❌ Missing enums: ${missingEnums.join(', ')}`)
      console.log('   This would block submissions. Run: POST /api/admin/migrate')
    } else {
      console.log('   ✓ All required enums present')
    }

    // 5. Summary
    console.log('\n' + '='.repeat(60))
    console.log('DIAGNOSIS:')
    console.log('='.repeat(60))
    
    if (orgs.rows.length === 0) {
      console.log('❌ No organizations → Submit returns 200 "Service not ready"')
      console.log('   FIX: Run migration or seed orgs')
    } else if (missingEnums.length) {
      console.log('❌ Missing enums → Submit returns 200 "Service not ready"')
      console.log('   FIX: Run migration')
    } else if (candidates.rows.length === 0) {
      console.log('❌ Submit succeeded but no candidates with this email')
      console.log('   POSSIBLE CAUSES:')
      console.log('   1. Submitted with a different email (check Supabase auth)')
      console.log('   2. Submit route has a bug (check response body for "ok: false")')
      console.log('   3. Redeploy needed (schema preflight fix not live)')
    } else {
      const latest = candidates.rows[0]
      console.log('✓ Submissions are working!')
      console.log(`   Latest: ${latest.full_name} in org "${latest.org_slug}"`)
      console.log(`   Created: ${latest.created_at}`)
      console.log('\n   TO SEE IN ADMIN DASHBOARD:')
      console.log(`   → Visit: https://www.wathefni.ai/${latest.org_slug}/admin`)
      console.log('\n   TO SEE IN CAREER DASHBOARD:')
      console.log(`   → Log in as: ${email}`)
      console.log(`   → Visit: /student/dashboard or /career/dashboard`)
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
  } finally {
    await client.end()
  }
}

main()
