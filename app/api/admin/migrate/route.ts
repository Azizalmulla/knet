import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const runtime = 'nodejs'

function ok(message: string, extra: any = {}) {
  return NextResponse.json({ ok: true, message, ...extra })
}

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status })
}

export async function POST(req: NextRequest) {
  // Simple guard: require a token header that matches MIGRATION_TOKEN or NEXTAUTH_SECRET (or JWT_SECRET as fallback)
  const url = new URL(req.url)
  const headerToken = req.headers.get('x-migrate-token') || url.searchParams.get('token') || ''
  const allowed = (process.env.MIGRATION_TOKEN || process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || '').trim()
  if (!allowed || headerToken !== allowed) {
    return bad('Unauthorized: missing or invalid token', 401)
  }

  const steps: { step: string; status: 'ok' | 'skip' | 'error'; detail?: string }[] = []
  async function run(step: string, fn: () => Promise<any>) {
    try {
      await fn()
      steps.push({ step, status: 'ok' })
    } catch (e: any) {
      steps.push({ step, status: 'error', detail: String(e?.message || e) })
    }
  }

  // 1) Extensions
  await run('extensions:uuid', async () => { await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` })
  await run('extensions:pg_trgm', async () => { await sql`CREATE EXTENSION IF NOT EXISTS "pg_trgm";` })
  await run('extensions:unaccent', async () => { await sql`CREATE EXTENSION IF NOT EXISTS "unaccent";` })
  await run('extensions:vector', async () => { await sql`CREATE EXTENSION IF NOT EXISTS vector;` })

  // 2) Enums
  await run('enum:yoe_bucket', async () => {
    await sql`DO $$ BEGIN CREATE TYPE yoe_bucket AS ENUM ('0-1','2-3','4-5','6+'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  })
  await run('enum:cv_type_enum', async () => {
    await sql`DO $$ BEGIN CREATE TYPE cv_type_enum AS ENUM ('uploaded','ai_generated'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  })
  await run('enum:parse_status_enum', async () => {
    await sql`DO $$ BEGIN CREATE TYPE parse_status_enum AS ENUM ('pending','processing','completed','failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  })

  // 3) Organizations base
  await run('organizations:create', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            text NOT NULL,
        slug            text UNIQUE NOT NULL,
        logo_url        text,
        created_at      timestamptz DEFAULT now()
      );
    `
  })
  await run('organizations:extra_columns', async () => {
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;`
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_code text UNIQUE;`
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domains jsonb DEFAULT '[]'::jsonb;`
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_ai_builder boolean DEFAULT true;`
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_exports boolean DEFAULT true;`
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enable_analytics boolean DEFAULT true;`
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();`
    await sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`
  })
  await run('organizations:indexes', async () => {
    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);`
    await sql`CREATE INDEX IF NOT EXISTS idx_organizations_is_public ON organizations(is_public) WHERE is_public = true;`
  })

  // 4) Admin tables (per-org)
  await run('admin_users:create', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email text NOT NULL,
        email_lc text GENERATED ALWAYS AS (lower(email)) STORED,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'admin',
        last_login timestamptz,
        created_at timestamptz DEFAULT now(),
        UNIQUE (org_id, email_lc)
      );
    `
  })
  await run('admin_users:index', async () => {
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_org_email ON admin_users(org_id, email_lc);`
  })

  await run('admin_sessions:create', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        token_hash text NOT NULL,
        ip_address text,
        user_agent text,
        expires_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `
  })

  // 5) Candidates (multi-tenant)
  await run('candidates:create', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS candidates (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        full_name text NOT NULL,
        email text NOT NULL,
        email_lc text GENERATED ALWAYS AS (lower(email)) STORED,
        phone text,
        location text,
        degree text,
        field_of_study text,
        field_of_study_other text,
        area_of_interest text,
        years_of_experience yoe_bucket,
        gpa numeric(3,2),
        cv_type cv_type_enum NOT NULL DEFAULT 'uploaded',
        cv_blob_key text,
        cv_mime text,
        cv_file_size integer,
        cv_template text,
        cv_json jsonb,
        parse_status parse_status_enum NOT NULL DEFAULT 'pending',
        suggested_vacancies jsonb,
        source text DEFAULT 'upload_form',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        deleted_at timestamptz,
        CHECK ((gpa IS NULL) OR (gpa >= 0 AND gpa <= 4)),
        UNIQUE (org_id, email_lc)
      );
    `
  })

  await run('candidates:indexes', async () => {
    await sql`CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(org_id);`
    await sql`CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(org_id, created_at DESC);`
    await sql`CREATE INDEX IF NOT EXISTS idx_candidates_parse_status ON candidates(org_id, parse_status);`
    await sql`CREATE INDEX IF NOT EXISTS idx_candidates_email_unique ON candidates(org_id, email_lc);`
  })

  // Relax NOT NULLs to align with current API behavior
  await run('candidates:relax_nulls', async () => {
    await sql`ALTER TABLE candidates ALTER COLUMN degree DROP NOT NULL;`
    await sql`ALTER TABLE candidates ALTER COLUMN field_of_study DROP NOT NULL;`
    await sql`ALTER TABLE candidates ALTER COLUMN area_of_interest DROP NOT NULL;`
    await sql`ALTER TABLE candidates ALTER COLUMN years_of_experience DROP NOT NULL;`
  })

  // 6) CV analysis table
  await run('cv_analysis:create', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS cv_analysis (
        candidate_id uuid PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        extracted_text text NOT NULL,
        page_count int,
        word_count int,
        confidence_score numeric(3,2),
        skills jsonb,
        experience_summary text,
        education_summary text,
        ai_feedback text,
        created_at timestamptz DEFAULT now()
      );
    `
  })
  await run('cv_analysis:index', async () => {
    await sql`CREATE INDEX IF NOT EXISTS idx_cv_analysis_org ON cv_analysis(org_id);`
  })

  // 7) Candidate decisions
  await run('candidate_decisions:create', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS candidate_decisions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        candidate_id uuid NOT NULL UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('pending','shortlisted','rejected','interviewed','hired')) DEFAULT 'pending',
        ai_feedback text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `
  })
  await run('candidate_decisions:index', async () => {
    await sql`CREATE INDEX IF NOT EXISTS idx_candidate_decisions_org ON candidate_decisions(org_id);`
  })

  // 8) Embeddings (pgvector)
  await run('candidate_embeddings:create', async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS candidate_embeddings (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        candidate_id uuid UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
        embedding vector(1536),
        content_summary text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `
  })
  await run('candidate_embeddings:index', async () => {
    await sql`CREATE INDEX IF NOT EXISTS idx_candidate_embeddings_org ON candidate_embeddings(org_id);`
  })

  // 9.5) Backfill: copy GPA from legacy students table when possible (idempotent)
  await run('backfill:candidates.gpa_from_students', async () => {
    try {
      const reg = await sql<{ c: string | null }>`SELECT to_regclass('public.students') as c`
      const hasStudents = !!reg.rows?.[0]?.c
      if (!hasStudents) return
      await sql`
        UPDATE candidates c
        SET gpa = s.gpa
        FROM students s
        JOIN organizations o ON o.slug = s.org_slug
        WHERE c.org_id = o.id
          AND c.email_lc = lower(s.email)
          AND c.gpa IS NULL
          AND s.gpa IS NOT NULL
      `
    } catch {}
  })

  // 9) Student auth table (for Supabase auth)
  await run('student_users:create', async () => {
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`
    await sql`
      CREATE TABLE IF NOT EXISTS student_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text UNIQUE NOT NULL,
        email_lc text GENERATED ALWAYS AS (lower(email)) STORED,
        name text,
        avatar_url text,
        created_at timestamptz DEFAULT now()
      );
    `
  })

  // 10) Sample orgs (idempotent)
  await run('organizations:seed', async () => {
    await sql`
      INSERT INTO organizations (slug, name, is_public, company_code, logo_url)
      VALUES
        ('knet', 'KNET', true, NULL, '/images/logos/knet.png'),
        ('nbk', 'National Bank of Kuwait', true, NULL, '/images/logos/nbk.png'),
        ('zain', 'Zain Kuwait', true, NULL, '/images/logos/zain.png'),
        ('private-co', 'Private Company', false, 'PRIV2024', NULL)
      ON CONFLICT (slug) DO UPDATE SET
        is_public = EXCLUDED.is_public,
        company_code = EXCLUDED.company_code,
        logo_url = EXCLUDED.logo_url,
        updated_at = now();
    `
  })

  return ok('Migration completed', { steps })
}

// Convenience: allow GET to trigger the same migration for one-click in browser
export async function GET(req: NextRequest) {
  return POST(req)
}
