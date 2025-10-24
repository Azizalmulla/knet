#!/usr/bin/env node
/*
  Guarded cleanup script: delete a specific candidate by id or email within an org.
  Safety:
    - Requires ENABLE_CLEANUP=true in env
    - Requires explicit --org and (--id or --email)
    - Interactive confirmation prompt (y/n)
    - Logs admin_activity (action = delete_candidate)

  Usage examples:
    ENABLE_CLEANUP=true DATABASE_URL=... node scripts/cleanup-candidate.js \
      --org careerly \
      --email test.candidate.prod+123@example.com \
      --admin-email admin@example.com \
      --reason "post-verification cleanup"

    ENABLE_CLEANUP=true DATABASE_URL=... node scripts/cleanup-candidate.js \
      --org careerly \
      --id 00000000-0000-0000-0000-000000000000
*/
const { Client } = require('pg')
const readline = require('readline')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, vRaw] = a.split('=')
      const k2 = k.replace(/^--/, '')
      const v = vRaw !== undefined ? vRaw : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
      args[k2] = v
    }
  }
  return args
}

function askConfirm(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (ans) => {
      rl.close()
      resolve(ans.trim().toLowerCase())
    })
  })
}

async function main() {
  // Safety gate
  if (String(process.env.ENABLE_CLEANUP).toLowerCase() !== 'true') {
    console.warn('Cleanup disabled: set ENABLE_CLEANUP=true to proceed.')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or POSTGRES_URL env')
    process.exit(1)
  }

  const args = parseArgs(process.argv)
  const orgSlug = args.org || args.slug
  const candidateId = args.id
  const email = args.email
  const adminEmail = args['admin-email'] || ''
  const reason = args.reason || 'test_cleanup'

  if (!orgSlug) {
    console.error('Missing --org <slug>')
    process.exit(1)
  }
  if (!candidateId && !email) {
    console.error('Missing candidate selector: provide --id <uuid> or --email <address>')
    process.exit(1)
  }

  const ssl = (dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require'))
    ? { rejectUnauthorized: false }
    : undefined
  const client = new Client({ connectionString: dbUrl, ssl })

  await client.connect()
  try {
    // Resolve org
    const orgRes = await client.query('SELECT id::uuid as id, name FROM organizations WHERE slug=$1 LIMIT 1', [orgSlug])
    if (!orgRes.rows.length) {
      console.error(`Organization not found for slug: ${orgSlug}`)
      process.exit(1)
    }
    const orgId = orgRes.rows[0].id

    // Find candidate by id or email (org scoped)
    let cand
    if (candidateId) {
      const q = await client.query('SELECT id::uuid as id, full_name, email FROM candidates WHERE id::uuid=$1 AND org_id=$2 LIMIT 1', [candidateId, orgId])
      cand = q.rows[0]
    } else {
      const q = await client.query('SELECT id::uuid as id, full_name, email FROM candidates WHERE org_id=$1 AND email_lc = lower($2) LIMIT 1', [orgId, email])
      cand = q.rows[0]
    }

    if (!cand) {
      console.log('No test candidate found.')
      return
    }

    const ans = await askConfirm(`You are about to permanently delete candidate "${cand.full_name}" (${cand.email}) for org "${orgSlug}". Continue? (y/n) `)
    if (ans !== 'y') {
      console.log('Aborted by user.')
      return
    }

    await client.query('BEGIN')
    // Audit log
    await client.query(
      `INSERT INTO admin_activity (organization_id, action, metadata)
       VALUES ($1, 'delete_candidate', jsonb_build_object(
         'candidate_id', $2::uuid,
         'email', $3::text,
         'admin_email', NULLIF($4::text,''),
         'reason', $5::text
       ))`,
      [orgId, cand.id, cand.email, adminEmail, reason]
    )

    const delRes = await client.query('DELETE FROM candidates WHERE id=$1 AND org_id=$2', [cand.id, orgId])
    await client.query('COMMIT')

    console.log(`Deleted candidate ${cand.id} (${cand.email}) from org ${orgSlug}. Rows affected: ${delRes.rowCount}`)
  } catch (e) {
    try { await client.query('ROLLBACK') } catch {}
    console.error('Cleanup failed:', e.message || e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
