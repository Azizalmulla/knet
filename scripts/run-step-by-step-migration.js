// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

async function runStepByStepMigration() {
  console.log('🚀 Running Step-by-Step Careerly Migration...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('📡 Testing connection...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL');
    
    // Step 1: Create super_admins table
    console.log('\n👑 Creating super_admins table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        email_lc text GENERATED ALWAYS AS (lower(email)) STORED,
        password_hash text NOT NULL,
        name text,
        created_at timestamptz DEFAULT now(),
        last_login timestamptz
      );
      CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email_lc);
    `);
    
    // Step 2: Add organization features if missing
    console.log('\n🏢 Updating organizations table...');
    await pool.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_ai_builder boolean DEFAULT true;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_exports boolean DEFAULT true;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_analytics boolean DEFAULT true;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_code text UNIQUE;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url text;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domains jsonb DEFAULT '[]'::jsonb;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    `);
    
    // Step 3: Create Watheefti fields
    console.log('\n📋 Creating Watheefti fields...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watheefti_fields (
        id serial PRIMARY KEY,
        category text NOT NULL,
        value_en text NOT NULL,
        value_ar text NOT NULL,
        display_order integer DEFAULT 0,
        is_active boolean DEFAULT true
      );
    `);
    
    // Step 4: Insert Watheefti data
    console.log('📝 Inserting Watheefti field options...');
    await pool.query(`
      INSERT INTO watheefti_fields (category, value_en, value_ar, display_order) VALUES
      ('field_of_study', 'Computer Science', 'علوم الحاسوب', 1),
      ('field_of_study', 'Information Technology', 'تقنية المعلومات', 2),
      ('field_of_study', 'Business Administration', 'إدارة الأعمال', 3),
      ('field_of_study', 'Engineering', 'الهندسة', 4),
      ('field_of_study', 'Finance', 'المالية', 5),
      ('field_of_study', 'Marketing', 'التسويق', 6),
      ('field_of_study', 'Others', 'أخرى', 999),
      ('area_of_interest', 'Software Development', 'تطوير البرمجيات', 1),
      ('area_of_interest', 'Data Science', 'علوم البيانات', 2),
      ('area_of_interest', 'Cybersecurity', 'الأمن السيبراني', 3),
      ('area_of_interest', 'Project Management', 'إدارة المشاريع', 4),
      ('area_of_interest', 'Sales', 'المبيعات', 5),
      ('degree', 'High School', 'الثانوية العامة', 1),
      ('degree', 'Diploma', 'دبلوم', 2),
      ('degree', 'Bachelor', 'بكالوريوس', 3),
      ('degree', 'Master', 'ماجستير', 4),
      ('degree', 'PhD', 'دكتوراه', 5)
      ON CONFLICT DO NOTHING;
    `);
    
    // Step 5: Insert default super admin
    console.log('\n👤 Creating default super admin...');
    await pool.query(`
      INSERT INTO super_admins (email, password_hash, name)
      VALUES (
        'super@careerly.com',
        '$2a$12$LQQKJPbqPGWKkYwNRWHRa.Jb1aJKW.AEd5H5jrZ5L9QKrHgGYLGdO',
        'Super Admin'
      ) ON CONFLICT (email) DO NOTHING;
    `);
    
    // Step 6: Insert sample organizations
    console.log('\n🏪 Creating sample organizations...');
    await pool.query(`
      INSERT INTO organizations (slug, name, is_public, logo_url, domains, enable_ai_builder, enable_exports) VALUES
      ('knet', 'KNET', true, '/images/logos/knet.png', '["knet.com.kw"]'::jsonb, true, true),
      ('nbk', 'National Bank of Kuwait', true, '/images/logos/nbk.png', '["nbk.com"]'::jsonb, true, true),
      ('zain', 'Zain Kuwait', true, '/images/logos/zain.png', '["zain.com"]'::jsonb, true, true),
      ('boubyan', 'Boubyan Bank', true, '/images/logos/boubyan.png', '["bankboubyan.com"]'::jsonb, false, true),
      ('stc', 'STC Kuwait', true, '/images/logos/stc.png', '["stc.com.kw"]'::jsonb, true, false)
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        is_public = EXCLUDED.is_public,
        logo_url = EXCLUDED.logo_url,
        domains = EXCLUDED.domains,
        enable_ai_builder = EXCLUDED.enable_ai_builder,
        enable_exports = EXCLUDED.enable_exports;
    `);
    
    // Step 7: Add fields to candidates table if missing
    console.log('\n👥 Updating candidates table...');
    await pool.query(`
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS degree text;
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS years_of_experience text;
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS field_of_study_other text;
      ALTER TABLE candidates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
    `);
    
    // Verify everything is working
    console.log('\n🔍 Verifying setup...');
    
    const orgs = await pool.query(`
      SELECT slug, name, is_public, enable_ai_builder, enable_exports 
      FROM organizations 
      ORDER BY name
    `);
    
    console.log(`\n🏢 Organizations: ${orgs.rows.length}`);
    orgs.rows.forEach(org => {
      const flags = [];
      if (org.enable_ai_builder) flags.push('AI');
      if (org.enable_exports) flags.push('Exports');
      console.log(`  ✅ ${org.name} (/${org.slug}) ${org.is_public ? '[Public]' : '[Private]'} [${flags.join(', ')}]`);
    });
    
    const superAdmins = await pool.query('SELECT email FROM super_admins');
    console.log(`\n👑 Super Admin: ${superAdmins.rows[0]?.email}`);
    
    const fieldCount = await pool.query('SELECT COUNT(*) as count FROM watheefti_fields');
    console.log(`📋 Watheefti Fields: ${fieldCount.rows[0].count} options`);
    
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 CAREERLY PLATFORM IS READY!');
    console.log('\n🚀 Next steps:');
    console.log('1. npm run dev');
    console.log('2. Visit: http://localhost:3000/super-admin/login');
    console.log('   - Email: super@careerly.com');
    console.log('   - Password: super123');
    console.log('3. Company Picker: http://localhost:3000/start');
    console.log('\n🇰🇼 Ready for all Kuwait organizations!');
    console.log('\n' + '='.repeat(60));
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
}

runStepByStepMigration();
