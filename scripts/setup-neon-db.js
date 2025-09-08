const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_de0aCQV5BrXM@ep-green-butterfly-ad10gisz-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

async function setupDatabase() {
  try {
    await client.connect();
    console.log('✅ Connected to Neon database');

    // Create students table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS students (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(255),
        field_of_study VARCHAR(255) NOT NULL,
        area_of_interest VARCHAR(255) NOT NULL,
        cv_type VARCHAR(50) NOT NULL,
        cv_url VARCHAR(500),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await client.query(createTableQuery);
    console.log('✅ Students table created successfully');

    // Test insert and select
    const testQuery = 'SELECT COUNT(*) FROM students';
    const result = await client.query(testQuery);
    console.log(`✅ Database ready - Current student count: ${result.rows[0].count}`);

  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    await client.end();
  }
}

setupDatabase();
