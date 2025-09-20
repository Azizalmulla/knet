-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE yoe_bucket AS ENUM ('0-1','2-3','4-5','6+');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE cv_type_enum AS ENUM ('uploaded','ai_generated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE parse_status_enum AS ENUM ('pending','processing','completed','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Multi-tenancy (per company/bank) ----------
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,            -- e.g. knet, nbk, gb, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin users for each org
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_lc TEXT GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (org_id, email_lc)
);

-- Sessions for admin users (JWT token hash stored for revocation / tracking)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_org ON admin_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Password reset tokens (hashed), single use
CREATE TABLE IF NOT EXISTS admin_password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_password_resets_lookup ON admin_password_resets(token_hash, expires_at);

-- ---------- Candidates ----------
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- PII
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_lc TEXT GENERATED ALWAYS AS (lower(email)) STORED,
  phone TEXT,
  location TEXT,

  -- Watheefti taxonomy (normalized)
  degree TEXT NOT NULL,                    -- e.g. "Bachelor's", "Master's", "Others"
  field_of_study TEXT NOT NULL,            -- canonical bucket (may be "Others")
  field_of_study_other TEXT,               -- free text when "Others" chosen
  area_of_interest TEXT NOT NULL,
  years_of_experience yoe_bucket NOT NULL,
  gpa NUMERIC(3,2),                        -- nullable; 0.00–4.00

  -- CV meta
  cv_type cv_type_enum NOT NULL,
  cv_blob_key TEXT,                        -- Vercel Blob key (not just URL)
  cv_mime TEXT,
  cv_file_size INTEGER,
  cv_template TEXT,                        -- minimal / modern / creative
  cv_json JSONB,                           -- structured preview data
  parse_status parse_status_enum NOT NULL DEFAULT 'pending',

  -- Flags / audit
  suggested_vacancies JSONB,
  source TEXT DEFAULT 'upload_form',       -- upload_form / qr / import / api
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,                  -- soft delete

  -- Constraints
  CHECK ((gpa IS NULL) OR (gpa >= 0 AND gpa <= 4)),
  UNIQUE (org_id, email_lc)                -- email uniqueness per tenant
);

-- ---------- CV Analysis ----------
CREATE TABLE IF NOT EXISTS cv_analysis (
  candidate_id UUID PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  extracted_text TEXT NOT NULL,
  page_count INT,
  word_count INT,
  confidence_score NUMERIC(3,2),
  skills JSONB,
  experience_summary TEXT,
  education_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- Embeddings (pgvector) ----------
CREATE TABLE IF NOT EXISTS candidate_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id UUID UNIQUE REFERENCES candidates(id) ON DELETE CASCADE,
  embedding vector(1536),
  content_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Recommended pgvector index (cosine). Adjust lists to your size.
CREATE INDEX IF NOT EXISTS idx_candidate_embeddings_ivf
  ON candidate_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ---------- Job postings (optional matching) ----------
CREATE TABLE IF NOT EXISTS job_postings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB,
  location TEXT,
  salary_range TEXT,
  employment_type TEXT CHECK (employment_type IN ('full_time','part_time','contract','internship')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create student_users table for student authentication
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS student_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  email_lc TEXT GENERATED ALWAYS AS (lower(email)) STORED,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_users_email ON student_users(email_lc);

CREATE TABLE IF NOT EXISTS candidate_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  job_posting_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  match_score NUMERIC(4,2),
  match_reasons JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (candidate_id, job_posting_id)
);

-- ---------- Text search (fast keyword search) ----------
-- Materialized TSV for quick name/email/skills queries
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS tsv tsvector;

CREATE OR REPLACE FUNCTION candidates_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.tsv :=
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.full_name),'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.email),'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.field_of_study),'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(unaccent(NEW.area_of_interest),'')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidates_tsv_update ON candidates;
CREATE TRIGGER trg_candidates_tsv_update
  BEFORE INSERT OR UPDATE OF full_name, email, field_of_study, area_of_interest
  ON candidates
  FOR EACH ROW EXECUTE FUNCTION candidates_tsv_update();

CREATE INDEX IF NOT EXISTS idx_candidates_tsv ON candidates USING GIN (tsv);

-- ---------- Generic updated_at triggers ----------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_candidates ON candidates;
CREATE TRIGGER trg_touch_candidates BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_job_postings ON job_postings;
CREATE TRIGGER trg_touch_job_postings BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_embeddings ON candidate_embeddings;
CREATE TRIGGER trg_touch_embeddings BEFORE UPDATE ON candidate_embeddings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------- Helpful indexes ----------
CREATE INDEX IF NOT EXISTS idx_candidates_org ON candidates(org_id);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_parse_status ON candidates(org_id, parse_status);
CREATE INDEX IF NOT EXISTS idx_candidates_taxonomy ON candidates(org_id, degree, years_of_experience, area_of_interest);
CREATE INDEX IF NOT EXISTS idx_candidates_email_unique ON candidates(org_id, email_lc);

CREATE INDEX IF NOT EXISTS idx_analysis_org ON cv_analysis(org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_org_active ON job_postings(org_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_org_score ON candidate_matches(org_id, match_score DESC);

-- Test query to verify tables exist
SELECT 
  table_name,
  COUNT(*) OVER() as total_tables
FROM 
  information_schema.tables 
WHERE 
  table_schema = 'public' 
  AND table_type = 'BASE TABLE'
  AND table_name IN ('admins', 'organizations', 'candidates', 'admin_sessions', 'student_users')
ORDER BY 
  table_name;
