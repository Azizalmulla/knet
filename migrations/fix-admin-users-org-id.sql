-- Add missing organization_id column to admin_users table
-- This is required for multi-tenant admin authentication

-- Add column if it doesn't exist
ALTER TABLE admin_users 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_org_id ON admin_users(organization_id);

-- Create index for email lookups within org (used in login)
CREATE INDEX IF NOT EXISTS idx_admin_users_org_email ON admin_users(organization_id, email_lc);

-- Verify the change
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'admin_users' 
  AND column_name = 'organization_id';

-- Show sample data
SELECT 
  id,
  email,
  organization_id,
  role,
  created_at
FROM admin_users
LIMIT 5;
