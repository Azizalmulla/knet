-- Add new fields to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS company_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS domains JSONB DEFAULT '[]'::jsonb;

-- Create admin_users table for per-org authentication
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_lc TEXT GENERATED ALWAYS AS (lower(email)) STORED,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'viewer', 'owner')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ,
  UNIQUE(organization_id, email_lc)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_org_email ON admin_users(organization_id, email_lc);
CREATE INDEX IF NOT EXISTS idx_organizations_company_code ON organizations(company_code) WHERE company_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_is_public ON organizations(is_public) WHERE is_public = true;

-- Create agent_audit table for AI agent audit logging
CREATE TABLE IF NOT EXISTS agent_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  organization_id UUID REFERENCES organizations(id),
  query TEXT NOT NULL,
  top_k INTEGER,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- Update candidate_embeddings to include org_id if not exists
ALTER TABLE candidate_embeddings 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Add index for org-scoped vector searches
CREATE INDEX IF NOT EXISTS idx_candidate_embeddings_org ON candidate_embeddings(organization_id);

-- Insert some sample data for testing
INSERT INTO organizations (slug, name, is_public, company_code, logo_url) VALUES
  ('nbk', 'National Bank of Kuwait', true, NULL, '/images/logos/nbk.png'),
  ('knet', 'KNET', true, NULL, '/images/logos/knet.png'),
  ('zain', 'Zain Kuwait', true, NULL, '/images/logos/zain.png'),
  ('private-co', 'Private Company', false, 'PRIV2024', NULL)
ON CONFLICT (slug) DO UPDATE SET
  is_public = EXCLUDED.is_public,
  company_code = EXCLUDED.company_code,
  logo_url = EXCLUDED.logo_url;
