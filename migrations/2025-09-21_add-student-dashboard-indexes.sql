-- Career Dashboard performance indexes (idempotent)
-- This migration adds indexes used by the Career Dashboard
-- and the new paginated submissions API.

-- New schema: public.candidates (UUID PK, org_id FK)
DO $$
BEGIN
  IF to_regclass('public.candidates') IS NOT NULL THEN
    -- Fast list by student + created_at (descending)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='candidates' AND column_name='email'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='candidates' AND column_name='created_at'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_candidates_email_created
        ON public.candidates (LOWER(email), created_at DESC);
    END IF;

    -- Fast filter by student + organization
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='candidates' AND column_name='email'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='candidates' AND column_name='org_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_candidates_email_org
        ON public.candidates (LOWER(email), org_id);
    END IF;
  END IF;
END $$;
