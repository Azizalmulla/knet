-- Performance index for org views and exports
-- Speeds up queries sorted by created_at within an org
DO $$
BEGIN
  IF to_regclass('public.candidates') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_candidates_org_created
      ON public.candidates (org_id, created_at DESC);
  END IF;
END $$;
