-- Map each submission (students row) to an organization by slug
CREATE TABLE IF NOT EXISTS public.student_submission_orgs (
  student_id INT PRIMARY KEY,
  org_slug VARCHAR(100) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for org lookups
CREATE INDEX IF NOT EXISTS idx_student_submission_orgs_org_slug
ON public.student_submission_orgs(org_slug);

-- Optional FK if organizations table exists
-- ALTER TABLE public.student_submission_orgs
--   ADD CONSTRAINT fk_student_submission_orgs_org
--   FOREIGN KEY (org_slug) REFERENCES public.organizations(slug);
