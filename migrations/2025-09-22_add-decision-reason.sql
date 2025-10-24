-- Add a separate reason column for human/admin decision notes
ALTER TABLE IF EXISTS public.candidate_decisions
  ADD COLUMN IF NOT EXISTS reason TEXT;
