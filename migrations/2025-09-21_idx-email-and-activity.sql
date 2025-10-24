-- Performance indexes for candidates email and admin activity timestamp
-- Candidates: lower(email) with created_at and org_id
CREATE INDEX IF NOT EXISTS idx_candidates_email_created ON public.candidates ((LOWER(email)), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_email_org ON public.candidates ((LOWER(email)), org_id);

-- Admin activity: org + timestamp
CREATE INDEX IF NOT EXISTS idx_admin_activity_org_ts ON public.admin_activity (organization_id, timestamp DESC);
