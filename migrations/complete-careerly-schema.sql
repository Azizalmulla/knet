-- Complete Careerly Multi-Tenant Schema with Super Admin
-- ========================================================

-- 1. Organizations table with feature flags
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  is_public       boolean DEFAULT true,
  company_code    text UNIQUE,
  logo_url        text,
  domains         jsonb DEFAULT '[]'::jsonb,
  
  -- Feature flags
  enable_ai_builder  boolean DEFAULT true,
  enable_exports     boolean DEFAULT true,
  enable_analytics   boolean DEFAULT true,
  
  -- Metadata
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz -- Soft delete
);

-- Add missing columns if table exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'enable_ai_builder') THEN
    ALTER TABLE organizations ADD COLUMN enable_ai_builder boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'enable_exports') THEN
    ALTER TABLE organizations ADD COLUMN enable_exports boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'enable_analytics') THEN
    ALTER TABLE organizations ADD COLUMN enable_analytics boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'deleted_at') THEN
    ALTER TABLE organizations ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(deleted_at);

-- 2. Super Admin table
-- --------------------
CREATE TABLE IF NOT EXISTS super_admins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  email_lc        text GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash   text NOT NULL,
  name            text,
  created_at      timestamptz DEFAULT now(),
  last_login      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email_lc);

-- 3. Super Admin Sessions
-- -----------------------
CREATE TABLE IF NOT EXISTS super_admin_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id  uuid NOT NULL REFERENCES super_admins(id) ON DELETE CASCADE,
  token_hash      text UNIQUE NOT NULL,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_token ON super_admin_sessions(token_hash);

-- 4. Super Admin Audit Log
-- ------------------------
CREATE TABLE IF NOT EXISTS super_admin_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id  uuid REFERENCES super_admins(id),
  org_id          uuid REFERENCES organizations(id),
  action          text NOT NULL, -- 'create_org', 'delete_org', 'create_admin', etc.
  payload         jsonb,
  timestamp       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_timestamp ON super_admin_audit(timestamp DESC);

-- 5. Admin Invitations
-- -------------------
CREATE TABLE IF NOT EXISTS admin_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  token           text UNIQUE NOT NULL,
  role            text DEFAULT 'admin',
  created_by      uuid REFERENCES super_admins(id),
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  accepted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_admin_invites_token ON admin_invites(token);
CREATE INDEX IF NOT EXISTS idx_admin_invites_expires ON admin_invites(expires_at);

-- 6. Enhanced Admin Users table
-- -----------------------------
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES super_admins(id);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS invite_token text REFERENCES admin_invites(token);

-- 7. Enhanced Candidates table with Watheefti fields
-- --------------------------------------------------
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS field_of_study_other text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS degree text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS years_of_experience text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_candidates_org_deleted ON candidates(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_candidates_field ON candidates(field_of_study);
CREATE INDEX IF NOT EXISTS idx_candidates_area ON candidates(area_of_interest);

-- 8. Full-text search on candidates
-- ---------------------------------
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', 
      coalesce(full_name, '') || ' ' || 
      coalesce(email, '') || ' ' ||
      coalesce(field_of_study, '') || ' ' ||
      coalesce(area_of_interest, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_candidates_search ON candidates USING GIN(search_vector);

-- 9. Candidate Embeddings with org isolation
-- ------------------------------------------
ALTER TABLE candidate_embeddings ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);

-- Update existing embeddings with org_id from candidates
UPDATE candidate_embeddings ce
SET org_id = c.organization_id
FROM candidates c
WHERE ce.candidate_id = c.id
AND ce.org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_candidate_embeddings_org ON candidate_embeddings(org_id);

-- 10. Telemetry/Analytics
-- -----------------------
CREATE TABLE IF NOT EXISTS admin_activity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid REFERENCES admin_users(id),
  organization_id uuid REFERENCES organizations(id),
  action          text NOT NULL, -- 'export_csv', 'export_pdf', 'delete_candidate', etc.
  metadata        jsonb,
  timestamp       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_org ON admin_activity(organization_id, timestamp DESC);

-- 11. Watheefti Reference Data
-- ----------------------------
CREATE TABLE IF NOT EXISTS watheefti_fields (
  id              serial PRIMARY KEY,
  category        text NOT NULL, -- 'field_of_study', 'area_of_interest', 'degree'
  value_en        text NOT NULL,
  value_ar        text NOT NULL,
  display_order   integer DEFAULT 0,
  is_active       boolean DEFAULT true
);

-- Insert Watheefti field values
INSERT INTO watheefti_fields (category, value_en, value_ar, display_order) VALUES
-- Field of Study
('field_of_study', 'Computer Science', 'علوم الحاسوب', 1),
('field_of_study', 'Information Technology', 'تقنية المعلومات', 2),
('field_of_study', 'Business Administration', 'إدارة الأعمال', 3),
('field_of_study', 'Engineering', 'الهندسة', 4),
('field_of_study', 'Finance', 'المالية', 5),
('field_of_study', 'Marketing', 'التسويق', 6),
('field_of_study', 'Human Resources', 'الموارد البشرية', 7),
('field_of_study', 'Law', 'القانون', 8),
('field_of_study', 'Medicine', 'الطب', 9),
('field_of_study', 'Others', 'أخرى', 999),

-- Area of Interest  
('area_of_interest', 'Software Development', 'تطوير البرمجيات', 1),
('area_of_interest', 'Data Science', 'علوم البيانات', 2),
('area_of_interest', 'Cybersecurity', 'الأمن السيبراني', 3),
('area_of_interest', 'Cloud Computing', 'الحوسبة السحابية', 4),
('area_of_interest', 'Project Management', 'إدارة المشاريع', 5),
('area_of_interest', 'Sales', 'المبيعات', 6),
('area_of_interest', 'Customer Service', 'خدمة العملاء', 7),
('area_of_interest', 'Operations', 'العمليات', 8),
('area_of_interest', 'Research', 'البحث', 9),

-- Degree
('degree', 'High School', 'الثانوية العامة', 1),
('degree', 'Diploma', 'دبلوم', 2),
('degree', 'Bachelor', 'بكالوريوس', 3),
('degree', 'Master', 'ماجستير', 4),
('degree', 'PhD', 'دكتوراه', 5)
ON CONFLICT DO NOTHING;

-- 12. Insert default super admin (password: super123)
-- ----------------------------------------------------
INSERT INTO super_admins (email, password_hash, name)
VALUES (
  'super@careerly.com',
  '$2a$12$LQQKJPbqPGWKkYwNRWHRa.Jb1aJKW.AEd5H5jrZ5L9QKrHgGYLGdO', -- super123
  'Super Admin'
) ON CONFLICT (email) DO NOTHING;

-- 13. Insert sample organizations with features
-- ---------------------------------------------
INSERT INTO organizations (slug, name, is_public, company_code, logo_url, domains, enable_ai_builder, enable_exports) VALUES
  ('knet', 'KNET', true, NULL, '/images/logos/knet.png', '["knet.com.kw"]'::jsonb, true, true),
  ('nbk', 'National Bank of Kuwait', true, NULL, '/images/logos/nbk.png', '["nbk.com"]'::jsonb, true, true),
  ('zain', 'Zain Kuwait', true, NULL, '/images/logos/zain.png', '["zain.com"]'::jsonb, true, true),
  ('boubyan', 'Boubyan Bank', true, NULL, '/images/logos/boubyan.png', '["bankboubyan.com"]'::jsonb, false, true),
  ('stc', 'STC Kuwait', true, NULL, '/images/logos/stc.png', '["stc.com.kw"]'::jsonb, true, false),
  ('private-test', 'Private Test Company', false, 'TEST2024', NULL, '[]'::jsonb, true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  is_public = EXCLUDED.is_public,
  company_code = EXCLUDED.company_code,
  logo_url = EXCLUDED.logo_url,
  domains = EXCLUDED.domains,
  enable_ai_builder = EXCLUDED.enable_ai_builder,
  enable_exports = EXCLUDED.enable_exports,
  updated_at = now();
