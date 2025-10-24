-- Add learning and personalization for AI Agent
-- Phase 3: User Preferences and Pattern Recognition

-- User preferences: Track what matters to each admin
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  preference_key VARCHAR(100) NOT NULL,
  preference_value TEXT NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.5,
  evidence_count INTEGER DEFAULT 1,
  last_reinforced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, admin_email, preference_key)
);

-- Hiring decisions: Track who was hired/rejected and why
CREATE TABLE IF NOT EXISTS hiring_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  candidate_name VARCHAR(255),
  decision VARCHAR(50) NOT NULL CHECK (decision IN ('hired', 'rejected', 'interviewed', 'shortlisted', 'passed')),
  reason TEXT,
  factors JSONB DEFAULT '{}'::jsonb,
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ DEFAULT now()
);

-- Search patterns: Track what users search for
CREATE TABLE IF NOT EXISTS search_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  search_type VARCHAR(50),
  query_text TEXT,
  filters_used JSONB DEFAULT '{}'::jsonb,
  results_count INTEGER,
  candidates_viewed JSONB DEFAULT '[]'::jsonb,
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  searched_at TIMESTAMPTZ DEFAULT now()
);

-- Candidate interactions: Track which candidates get attention
CREATE TABLE IF NOT EXISTS candidate_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interaction_type VARCHAR(50) NOT NULL,
  interaction_data JSONB DEFAULT '{}'::jsonb,
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  interacted_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_user_prefs_admin 
  ON user_preferences(org_id, admin_email, confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_user_prefs_key 
  ON user_preferences(preference_key);

CREATE INDEX IF NOT EXISTS idx_hiring_decisions_admin 
  ON hiring_decisions(org_id, admin_email, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_hiring_decisions_decision 
  ON hiring_decisions(decision, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_patterns_admin 
  ON search_patterns(org_id, admin_email, searched_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_interactions_admin 
  ON candidate_interactions(org_id, admin_email, interacted_at DESC);

CREATE INDEX IF NOT EXISTS idx_candidate_interactions_candidate 
  ON candidate_interactions(candidate_id, interacted_at DESC);

-- Full-text search on reasons and queries
CREATE INDEX IF NOT EXISTS idx_hiring_decisions_reason_fts 
  ON hiring_decisions USING gin(to_tsvector('english', reason));

CREATE INDEX IF NOT EXISTS idx_search_patterns_query_fts 
  ON search_patterns USING gin(to_tsvector('english', query_text));

-- Comments
COMMENT ON TABLE user_preferences IS 'Learned preferences for each admin (e.g., prefers high GPA, values experience)';
COMMENT ON TABLE hiring_decisions IS 'Track hiring outcomes to learn what leads to success';
COMMENT ON TABLE search_patterns IS 'Track search behavior to predict future needs';
COMMENT ON TABLE candidate_interactions IS 'Track which candidates get viewed, analyzed, compared';
COMMENT ON COLUMN user_preferences.confidence_score IS 'How confident we are in this preference (0.0-1.0)';
COMMENT ON COLUMN user_preferences.evidence_count IS 'Number of times this preference was reinforced';
