-- Enhanced Organizations table with all required fields
CREATE TABLE IF NOT EXISTS organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  slug         text UNIQUE NOT NULL,         -- e.g., 'knet', 'nbk'
  is_public    boolean DEFAULT true,
  company_code text UNIQUE,                  -- for private picker access
  logo_url     text,
  domains      jsonb DEFAULT '[]'::jsonb,    -- email domain hints
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Add missing columns to existing organizations table if needed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_public') THEN
    ALTER TABLE organizations ADD COLUMN is_public boolean DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'company_code') THEN
    ALTER TABLE organizations ADD COLUMN company_code text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'logo_url') THEN
    ALTER TABLE organizations ADD COLUMN logo_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'domains') THEN
    ALTER TABLE organizations ADD COLUMN domains jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'updated_at') THEN
    ALTER TABLE organizations ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Admin users scoped to organizations
CREATE TABLE IF NOT EXISTS admin_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  email_lc        text GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash   text NOT NULL,             -- bcrypt
  role            text NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'viewer')),
  created_at      timestamptz DEFAULT now(),
  last_login      timestamptz,
  UNIQUE (organization_id, email_lc)
);

CREATE INDEX IF NOT EXISTS idx_admin_users_org ON admin_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email_lc);

-- Agent audit log for tracking AI queries
CREATE TABLE IF NOT EXISTS agent_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid REFERENCES admin_users(id),
  organization_id uuid REFERENCES organizations(id),
  query           text NOT NULL,
  top_k           integer,
  timestamp       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_org ON agent_audit(organization_id);

-- Session tracking for security
CREATE TABLE IF NOT EXISTS admin_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  token_hash      text NOT NULL UNIQUE,
  ip_address      text,
  user_agent      text,
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  revoked         boolean DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);

-- Insert sample organizations
INSERT INTO organizations (slug, name, is_public, company_code, logo_url, domains) VALUES
  ('knet', 'KNET', true, NULL, '/images/logos/knet.png', '["knet.com.kw"]'::jsonb),
  ('nbk', 'National Bank of Kuwait', true, NULL, '/images/logos/nbk.png', '["nbk.com"]'::jsonb),
  ('zain', 'Zain Kuwait', true, NULL, '/images/logos/zain.png', '["zain.com"]'::jsonb),
  ('boubyan', 'Boubyan Bank', true, NULL, '/images/logos/boubyan.png', '["bankboubyan.com"]'::jsonb),
  ('stc', 'STC Kuwait', true, NULL, '/images/logos/stc.png', '["stc.com.kw"]'::jsonb),
  ('private-co', 'Private Company', false, 'PRIV2024', NULL, '[]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  is_public = EXCLUDED.is_public,
  company_code = EXCLUDED.company_code,
  logo_url = EXCLUDED.logo_url,
  domains = EXCLUDED.domains,
  updated_at = now();
