-- Create admin_activity table if missing (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid() on Neon/PG

CREATE TABLE IF NOT EXISTS public.admin_activity (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NULL,
  organization_id uuid REFERENCES public.organizations(id),
  action          text NOT NULL,
  metadata        jsonb,
  timestamp       timestamptz DEFAULT now()
);

-- Helpful index for org + recent time queries
CREATE INDEX IF NOT EXISTS idx_admin_activity_org ON public.admin_activity (organization_id, timestamp DESC);
