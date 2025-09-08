import { sql } from '@vercel/postgres';

export const db = sql;

// The following is the SQL to create the table in Vercel Postgres dashboard:

// CREATE TABLE students (
//   id SERIAL PRIMARY KEY,
//   full_name VARCHAR(255) NOT NULL,
//   email VARCHAR(255) NOT NULL UNIQUE,
//   phone VARCHAR(255),
//   field_of_study VARCHAR(255) NOT NULL,
//   area_of_interest VARCHAR(255) NOT NULL,
//   cv_type VARCHAR(50) NOT NULL, // 'uploaded' or 'ai'
//   cv_url VARCHAR(500),
//   submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// For blob, we'll use @vercel/blob

// Also, perhaps a table for vacancies, but since it's from JSON, maybe not needed.
