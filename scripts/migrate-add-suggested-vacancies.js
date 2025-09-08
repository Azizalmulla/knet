const { Client } = require('pg');

const connectionString = process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_de0aCQV5BrXM@ep-green-butterfly-ad10gisz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Postgres');

    await client.query(`
      ALTER TABLE IF EXISTS students
      ADD COLUMN IF NOT EXISTS suggested_vacancies TEXT;
    `);

    console.log('Migration complete: suggested_vacancies column ensured');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
