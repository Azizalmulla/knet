const { Client } = require('pg');

const connectionString = process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_de0aCQV5BrXM@ep-green-butterfly-ad10gisz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to Postgres');

    // Add suggested_vacancies_list column for easy filtering
    await client.query(`
      ALTER TABLE IF EXISTS students
      ADD COLUMN IF NOT EXISTS suggested_vacancies_list TEXT[];
    `);

    // Add index for faster filtering
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_field_area 
      ON students(field_of_study, area_of_interest);
    `);

    console.log('Migration complete: added suggested_vacancies_list and index');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
