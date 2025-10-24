#!/usr/bin/env node
/*
  Guarded cleanup script: delete a specific Vercel Blob object by exact key.
  Safety:
    - Requires ENABLE_CLEANUP=true in env
    - Requires explicit --org and --key
    - Interactive confirmation prompt (y/n)
    - Logs admin_activity (action = delete_blob) with org_id linkage

  Usage example:
    ENABLE_CLEANUP=true \
    VERCEL_BLOB_READ_WRITE_TOKEN=... \
    DATABASE_URL=... \
    node scripts/cleanup-blob.js \
      --org careerly \
      --key careerly/test-presign.pdf \
      --admin-email admin@example.com \
      --reason "post-verification cleanup"
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
  if (String(process.env.ENABLE_CLEANUP).toLowerCase() !== 'true') {
    console.warn('Cleanup disabled: set ENABLE_CLEANUP=true to proceed.')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or POSTGRES_URL env')
    process.exit(1)
  }

  const token = process.env.VERCEL_BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.error('Missing VERCEL_BLOB_READ_WRITE_TOKEN env')
    process.exit(1)
  }

  const args = parseArgs(process.argv)
  const orgSlug = args.org || args.slug
  const key = args.key
  const adminEmail = args['admin-email'] || ''
  const reason = args.reason || 'test_cleanup'

  if (!orgSlug) {
    console.error('Missing --org <slug>')
    process.exit(1)
  }
  if (!key) {
    console.error('Missing --key <blob-pathname>')
    process.exit(1)
  }
  if (key.includes('*')) {
    console.error('Wildcard deletions are not allowed. Provide an exact key.')
    process.exit(1)
  }

  console.log(`Target org: ${orgSlug}`)
  console.log(`Blob key: ${key}`)
  const ans = await askConfirm(`You are about to permanently delete blob "${key}" for org "${orgSlug}". Continue? (y/n) `)
  if (ans !== 'y') {
    console.log('Aborted by user.')
    return
  }

  const ssl = (dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require'))
    ? { rejectUnauthorized: false }
    : undefined
  const client = new Client({ connectionString: dbUrl, ssl })

  await client.connect()
  try {
    const orgRes = await client.query('SELECT id::uuid as id FROM organizations WHERE slug=$1 LIMIT 1', [orgSlug])
    if (!orgRes.rows.length) {
      console.error(`Organization not found for slug: ${orgSlug}`)
      process.exit(1)
    }
    const orgId = orgRes.rows[0].id

    // Delete blob via Vercel Blob API
    const { del } = require('@vercel/blob')
    const res = await del(key, { token })
    // res: { url?, count? }, treat success if no error thrown

    // Log admin_activity after deletion succeeds
    await client.query(
      `INSERT INTO admin_activity (organization_id, action, metadata)
       VALUES ($1, 'delete_blob', jsonb_build_object(
         'blob_key', $2::text,
         'admin_email', NULLIF($3::text,''),
         'reason', $4::text
       ))`,
      [orgId, key, adminEmail, reason]
    )

    console.log('Deleted blob:', key)
  } catch (e) {
    console.error('Blob cleanup failed:', e.message || e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
