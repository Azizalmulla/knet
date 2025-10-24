-- Add org_slug column to students table if it doesn't exist
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS org_slug VARCHAR(100);

-- Create index for faster org-based queries
CREATE INDEX IF NOT EXISTS idx_students_org_slug 
ON public.students(org_slug);

-- Create index for email + org combination
CREATE INDEX IF NOT EXISTS idx_students_email_org 
ON public.students(email, org_slug);

-- Add foreign key constraint (optional, only if organizations table exists)
-- ALTER TABLE public.students 
-- ADD CONSTRAINT fk_students_org_slug 
-- FOREIGN KEY (org_slug) REFERENCES organizations(slug);
