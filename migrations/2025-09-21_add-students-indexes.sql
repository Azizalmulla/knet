-- Legacy students indexes for Career Dashboard (idempotent)
-- Only creates indexes if table and target columns exist.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'students' AND c.relkind IN ('r','p')
  ) THEN
    -- (LOWER(email), submitted_at DESC)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='students' AND column_name='email'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='students' AND column_name='submitted_at'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_students_email_submitted
        ON public.students (LOWER(email), submitted_at DESC);
    END IF;

    -- (LOWER(email), org_slug)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='students' AND column_name='email'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='students' AND column_name='org_slug'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_students_email_org
        ON public.students (LOWER(email), org_slug);
    END IF;
  END IF;
END $$;
