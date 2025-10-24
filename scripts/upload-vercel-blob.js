#!/usr/bin/env node
/*
  Upload a small file to Vercel Blob for testing presigned downloads.
  Usage:
    VERCEL_BLOB_READ_WRITE_TOKEN=... node scripts/upload-vercel-blob.js --key careerly/test-presign.pdf [--file ./local.pdf]
*/
const fs = require('fs')
const path = require('path')

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
  const token = process.env.VERCEL_BLOB_READ_WRITE_TOKEN
  if (!token) {
    console.error('Missing VERCEL_BLOB_READ_WRITE_TOKEN env')
    process.exit(1)
  }
  const args = parseArgs(process.argv)
  const key = args.key
  const file = args.file
  if (!key) {
    console.error('Missing --key <blob-pathname> (e.g., careerly/test-presign.pdf)')
    process.exit(1)
  }

  let data
  let contentType = 'application/pdf'
  if (file) {
    const abs = path.resolve(process.cwd(), file)
    if (!fs.existsSync(abs)) {
      console.error('File not found:', abs)
      process.exit(1)
    }
    data = fs.readFileSync(abs)
    // naive infer content-type
    const ext = path.extname(abs).toLowerCase()
    if (ext === '.txt') contentType = 'text/plain; charset=utf-8'
  } else {
    // Minimal dummy PDF bytes (not a real PDF but enough to download for E2E)
    data = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF\n')
  }

  try {
    const { put } = require('@vercel/blob')
    const res = await put(key, data, { access: 'public', contentType, token })
    console.log(JSON.stringify({ ok: true, pathname: res.pathname, url: res.url }))
  } catch (e) {
    console.error('Upload failed:', e.message || e)
    process.exit(1)
  }
}

main()
