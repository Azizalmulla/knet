#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const { sql } = require('@vercel/postgres')

async function runMigration() {
  console.log('🚀 Running Student Auth Migration...')
  
  try {
    // Set POSTGRES_URL from DATABASE_URL if not set
    if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
      process.env.POSTGRES_URL = process.env.DATABASE_URL
    }
    
    console.log('📡 Testing connection...')
    
    // Test connection
    const testResult = await sql`SELECT 1 as test`
    console.log('✅ Database connection successful')
    
    // Create student_users table
    console.log('📝 Creating student_users table...')
    
    await sql`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `
    
    await sql`
      CREATE TABLE IF NOT EXISTS student_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        email_lc TEXT GENERATED ALWAYS AS (lower(email)) STORED,
        name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_student_users_email ON student_users(email_lc);
    `
    
    console.log('✅ student_users table created successfully')
    
    // Verify table exists
    const tableCheck = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'student_users'
    `
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Migration completed successfully!')
      console.log('📊 student_users table is ready for NextAuth')
    } else {
      console.log('❌ Table creation verification failed')
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  }
}

runMigration()
