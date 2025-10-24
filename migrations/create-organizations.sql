-- Create organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  is_public BOOLEAN DEFAULT true,
  company_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Insert default Careerly organization if it doesn't exist
INSERT INTO organizations (name, slug, is_public)
VALUES ('Careerly', 'careerly', true)
ON CONFLICT (slug) DO NOTHING;

-- Optional: Insert some sample organizations
-- INSERT INTO organizations (name, slug, is_public) VALUES 
-- ('Tech Corp', 'techcorp', true),
-- ('Finance Inc', 'finance', true),
-- ('Healthcare Co', 'healthcare', true)
-- ON CONFLICT (slug) DO NOTHING;
