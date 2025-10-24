-- Adds AI feedback to cv_analysis and a candidate_decisions table for application decisions

-- Ensure uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Add ai_feedback column to cv_analysis (idempotent)
ALTER TABLE IF EXISTS public.cv_analysis
  ADD COLUMN IF NOT EXISTS ai_feedback TEXT;

-- 2) Create candidate_decisions table (idempotent)
CREATE TABLE IF NOT EXISTS public.candidate_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL UNIQUE REFERENCES public.candidates(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','shortlisted','rejected','interviewed','hired')) DEFAULT 'pending',
  ai_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidate_decisions_org ON public.candidate_decisions(org_id);
