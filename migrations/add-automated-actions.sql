-- Add automated actions support for AI Agent
-- Phase 1: Shortlists and Email Logs

-- Shortlists: Save groups of candidates with names
CREATE TABLE IF NOT EXISTS shortlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by VARCHAR(255), -- Admin email or ID
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Shortlist members: Link candidates to shortlists
CREATE TABLE IF NOT EXISTS shortlist_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shortlist_id UUID NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shortlist_id, candidate_id)
);

-- Email logs: Track all emails sent by AI Agent
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  body TEXT,
  email_type VARCHAR(50), -- 'interview_request', 'rejection', 'follow_up', etc.
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  sent_by VARCHAR(255), -- Admin email or AI
  sent_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB -- Store additional context
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shortlists_org ON shortlists(org_id);
CREATE INDEX IF NOT EXISTS idx_shortlist_members_shortlist ON shortlist_members(shortlist_id);
CREATE INDEX IF NOT EXISTS idx_shortlist_members_candidate ON shortlist_members(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_org ON email_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_candidate ON email_logs(candidate_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Update triggers
CREATE TRIGGER trg_touch_shortlists BEFORE UPDATE ON shortlists
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Comments
COMMENT ON TABLE shortlists IS 'Named collections of candidates saved by recruiters';
COMMENT ON TABLE shortlist_members IS 'Links candidates to shortlists';
COMMENT ON TABLE email_logs IS 'Audit log of all emails sent through the AI agent';
