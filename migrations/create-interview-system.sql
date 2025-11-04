-- AI Interview Intelligence System
-- Stores interview templates, candidate responses, and AI analysis

-- Interview Templates (created by admins)
CREATE TABLE IF NOT EXISTS interview_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by UUID, -- admin_users.id
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interview Questions
CREATE TABLE IF NOT EXISTS interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES interview_templates(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'video' CHECK (question_type IN ('video', 'text', 'code')),
  time_limit_seconds INTEGER DEFAULT 120, -- 2 minutes default
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Interview Sessions (one per candidate)
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES interview_templates(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video Responses (one per question)
CREATE TABLE IF NOT EXISTS interview_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
  video_blob_key TEXT, -- Vercel Blob storage key
  video_duration_seconds INTEGER,
  transcript TEXT, -- AI-generated transcript
  recorded_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, question_id)
);

-- AI Analysis Results
CREATE TABLE IF NOT EXISTS interview_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES interview_responses(id) ON DELETE CASCADE,
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  content_quality_score INTEGER CHECK (content_quality_score >= 0 AND content_quality_score <= 100),
  communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
  technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
  ai_reasoning TEXT, -- Why these scores?
  key_strengths JSONB DEFAULT '[]'::jsonb, -- Array of strings
  key_concerns JSONB DEFAULT '[]'::jsonb, -- Array of strings
  detected_language TEXT,
  sentiment TEXT, -- positive, neutral, negative
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(response_id)
);

-- Admin Reviews (human override/notes)
CREATE TABLE IF NOT EXISTS interview_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES admin_users(id),
  admin_email TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  decision TEXT CHECK (decision IN ('shortlist', 'reject', 'maybe', null)),
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_interview_templates_org ON interview_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_interview_questions_template ON interview_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_org ON interview_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_status ON interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_interview_responses_session ON interview_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_interview_analysis_response ON interview_analysis(response_id);
CREATE INDEX IF NOT EXISTS idx_interview_reviews_session ON interview_reviews(session_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_interview_templates_updated_at BEFORE UPDATE ON interview_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
