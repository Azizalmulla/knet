const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
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
    if (val.toLowerCase().startsWith('psql ')) val = val.slice(5).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  });
}

function main() {
  loadEnvLocal();
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!dbUrl) {
    console.log('No DATABASE_URL/POSTGRES_URL found.');
    process.exit(1);
  }
  try {
    const u = new URL(dbUrl.replace(/^psql\s+/, ''));
    console.log('DB host:', u.hostname);
    console.log('DB path:', u.pathname);
    console.log('SSL mode:', u.searchParams.get('sslmode'));
  } catch (e) {
    console.log('Could not parse URL:', e.message);
  }
}

main();
