-- Switch candidates.org_id FK to ON DELETE RESTRICT (idempotent-ish)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'candidates'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'candidates_org_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.candidates DROP CONSTRAINT candidates_org_id_fkey';
  END IF;
END $$;

ALTER TABLE public.candidates
  ADD CONSTRAINT candidates_org_id_fkey
  FOREIGN KEY (org_id)
  REFERENCES public.organizations(id)
  ON DELETE RESTRICT;
