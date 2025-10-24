-- Composite index to speed up decision filtering per tenant
-- Use CONCURRENTLY to avoid long locks in production.
-- Idempotent via IF NOT EXISTS.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidate_decisions_org_status
  ON public.candidate_decisions (org_id, status);
