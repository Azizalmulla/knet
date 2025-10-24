#!/usr/bin/env node
const { Client } = require('pg')

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

async function main() {
  const args = parseArgs(process.argv)
  const org = args.org || args.slug
  const name = args.name || 'TEST Candidate PROD'
  const email = args.email || 'test.candidate.prod@careerly.e2e'
  const phone = args.phone || ''
  const field = args.field || 'Computer Science'
  const area = args.area || 'Software Development'
  const degree = args.degree || 'Bachelor'
  const yoe = args.yoe || '0-1'
  const cvType = args['cv-type'] || 'uploaded'
  const blobKey = args['blob-key']
  const parseStatus = args['parse-status'] || 'completed'
  const updateIfExists = String(args['update-if-exists'] || 'true') === 'true'

  if (!org) {
    console.error('Missing --org <slug>')
    process.exit(1)
  }
  if (!blobKey) {
    console.error('Missing --blob-key <vercel-blob-key>')
    process.exit(1)
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!dbUrl) {
    console.error('Missing DATABASE_URL or POSTGRES_URL env')
    process.exit(1)
  }

  const ssl = (dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require'))
    ? { rejectUnauthorized: false }
    : undefined
  const client = new Client({ connectionString: dbUrl, ssl })

  await client.connect()
  try {
    const orgRes = await client.query('SELECT id::uuid AS id FROM organizations WHERE slug = $1 LIMIT 1', [org])
    if (!orgRes.rows.length) {
      console.error(`Organization not found for slug: ${org}`)
      process.exit(1)
    }
    const orgId = orgRes.rows[0].id

    const upsertSql = updateIfExists
      ? `INSERT INTO candidates (org_id, full_name, email, phone, field_of_study, area_of_interest, degree, years_of_experience, cv_type, cv_blob_key, parse_status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::yoe_bucket,$9::cv_type_enum,$10,$11::parse_status_enum, now())
         ON CONFLICT (org_id, email_lc) DO UPDATE SET cv_blob_key = EXCLUDED.cv_blob_key, updated_at = now()
         RETURNING id::uuid as id`
      : `INSERT INTO candidates (org_id, full_name, email, phone, field_of_study, area_of_interest, degree, years_of_experience, cv_type, cv_blob_key, parse_status, created_at)
         SELECT $1,$2,$3,$4,$5,$6,$7,$8::yoe_bucket,$9::cv_type_enum,$10,$11::parse_status_enum, now()
         WHERE NOT EXISTS (
           SELECT 1 FROM candidates WHERE org_id = $1 AND email_lc = lower($3)
         )
         RETURNING id::uuid as id`

    const params = [orgId, name, email, phone, field, area, degree, yoe, cvType, blobKey, parseStatus]
    const ins = await client.query(upsertSql, params)

    const id = ins.rows?.[0]?.id
      || (await client.query('SELECT id::uuid as id FROM candidates WHERE org_id = $1 AND email_lc = lower($2) LIMIT 1', [orgId, email])).rows?.[0]?.id

    console.log(JSON.stringify({ ok: true, org, orgId, id, email, blobKey }))
  } catch (e) {
    console.error('Failed to seed candidate:', e.message || e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
