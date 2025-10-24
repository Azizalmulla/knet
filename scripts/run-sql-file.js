// Minimal .env.local loader to avoid external deps
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) return;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Handle copy-pasted Neon 'psql' command style: psql 'postgresql://...'
      if (val.toLowerCase().startsWith('psql ')) {
        val = val.slice(5).trim();
      }
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // Always override so we don't accidentally use a stale env value from the shell
      process.env[key] = val;
    });
  } catch (e) {
    console.warn('Warning: failed to load .env.local:', e?.message || e);
  }
}

async function main() {
  loadEnvLocal();
  const { Pool } = require('pg');
  const rel = process.argv[2];
  if (!rel) {
    console.error('Usage: node scripts/run-sql-file.js <relative-path-to-sql>');
    process.exit(1);
  }
  const filePath = path.join(process.cwd(), rel);
  if (!fs.existsSync(filePath)) {
    console.error('SQL file not found:', filePath);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (dbUrl) {
    try {
      const redacted = dbUrl.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
      console.log('Using database URL from .env.local:', redacted);
    } catch {
      console.log('Using database URL from .env.local');
    }
  }
  if (!dbUrl) {
    console.error('No DATABASE_URL/POSTGRES_URL found. Please configure your .env.local');
    process.exit(1);
  }

  console.log('📄 Executing SQL file:', rel);
  try {
    const sqlText = fs.readFileSync(filePath, 'utf8');
    const ssl = (dbUrl.includes('neon.tech') || dbUrl.includes('sslmode=require'))
      ? { rejectUnauthorized: false }
      : undefined;
    // Parse the DATABASE_URL manually to avoid env overrides (e.g., PGHOST=host)
    const { URL } = require('url');
    const u = new URL(dbUrl);
    const parsed = {
      host: u.hostname,
      port: Number(u.port || 5432),
      user: decodeURIComponent(u.username || ''),
      database: (u.pathname || '/').replace(/^\//, ''),
    };
    console.log('DB params:', { host: parsed.host, port: parsed.port, user: parsed.user, database: parsed.database });
    // Force PG* env vars to avoid any external overrides
    process.env.PGHOST = parsed.host;
    process.env.PGPORT = String(parsed.port);
    process.env.PGDATABASE = parsed.database;
    process.env.PGUSER = parsed.user;
    process.env.PGPASSWORD = decodeURIComponent(u.password || '');
    if (ssl) process.env.PGSSLMODE = 'require';

    // DNS pre-check for clearer diagnostics
    try {
      const dns = require('dns');
      await new Promise((resolve) => {
        dns.lookup(parsed.host, (err, addr) => {
          console.log('DNS lookup:', parsed.host, '->', err ? ('ERROR: ' + err.message) : addr);
          resolve();
        });
      });
    } catch {}
    const pool = new Pool({
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: decodeURIComponent(u.password || ''),
      database: parsed.database,
      ssl,
    });
    await pool.query(sqlText);
    await pool.end();
    console.log('✅ SQL executed successfully');
  } catch (err) {
    console.error('❌ Failed to execute SQL:', err.message || err);
    process.exit(1);
  }
}

main();
