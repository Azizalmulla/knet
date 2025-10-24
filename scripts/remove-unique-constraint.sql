-- Remove unique constraint to allow multiple submissions per org per user
-- Run this directly in your database (Neon, Supabase console, etc.)

-- Find and drop the constraint
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_org_id_email_lc_key;
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_org_id_email_key;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_candidates_org_email_created 
  ON candidates(org_id, email_lc, created_at DESC);

-- Verify it's gone
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'candidates'::regclass 
  AND contype = 'u';
