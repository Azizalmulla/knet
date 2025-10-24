-- Remove unique constraint to allow multiple submissions per org per user
-- This allows users to submit updated CVs or reapply to the same organization

-- Drop the unique constraint on (org_id, email_lc)
-- First, find the constraint name (it may vary by Postgres version)
DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'candidates'::regclass
      AND contype = 'u'  -- unique constraint
      AND array_length(conkey, 1) = 2  -- constraint on 2 columns
      AND conkey[1] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'candidates'::regclass AND attname = 'org_id')
      AND conkey[2] = (SELECT attnum FROM pg_attribute WHERE attrelid = 'candidates'::regclass AND attname = 'email_lc');
    
    -- Drop if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE candidates DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No unique constraint found on (org_id, email_lc)';
    END IF;
END $$;

-- Also try common constraint names as fallback
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_org_id_email_lc_key;
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_org_id_email_key;

-- Add index for performance (since we removed the unique constraint)
CREATE INDEX IF NOT EXISTS idx_candidates_org_email_created 
  ON candidates(org_id, email_lc, created_at DESC);

-- Verify
DO $$ 
BEGIN
    RAISE NOTICE 'Migration complete. Users can now submit multiple CVs to the same organization.';
END $$;
