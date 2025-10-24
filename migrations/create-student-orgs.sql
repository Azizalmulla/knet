-- Create student_orgs mapping table
-- This table maps students to their selected organizations
CREATE TABLE IF NOT EXISTS public.student_orgs (
  email TEXT PRIMARY KEY,
  org_slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for org_slug lookups
CREATE INDEX IF NOT EXISTS idx_student_orgs_org_slug 
ON public.student_orgs(org_slug);

-- Create index for email + org combination
CREATE INDEX IF NOT EXISTS idx_student_orgs_email_org 
ON public.student_orgs(email, org_slug);
