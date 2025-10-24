-- Add portfolio analysis for AI Agent
-- Phase 4: Portfolio Review & Quality Assessment

-- Portfolio analyses: Store scraped and analyzed portfolio data
CREATE TABLE IF NOT EXISTS portfolio_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- GitHub data
  github_url TEXT,
  github_username VARCHAR(255),
  github_repos INTEGER DEFAULT 0,
  github_stars INTEGER DEFAULT 0,
  github_forks INTEGER DEFAULT 0,
  github_followers INTEGER DEFAULT 0,
  github_contributions INTEGER DEFAULT 0,
  github_languages JSONB DEFAULT '[]'::jsonb,
  github_top_repos JSONB DEFAULT '[]'::jsonb,
  
  -- Design portfolio data (Behance/Dribbble)
  behance_url TEXT,
  behance_username VARCHAR(255),
  behance_projects INTEGER DEFAULT 0,
  behance_followers INTEGER DEFAULT 0,
  behance_views INTEGER DEFAULT 0,
  behance_appreciations INTEGER DEFAULT 0,
  behance_style_tags TEXT[],
  behance_top_projects JSONB DEFAULT '[]'::jsonb,
  
  dribbble_url TEXT,
  dribbble_username VARCHAR(255),
  dribbble_shots INTEGER DEFAULT 0,
  dribbble_followers INTEGER DEFAULT 0,
  dribbble_likes INTEGER DEFAULT 0,
  
  -- LinkedIn data
  linkedin_url TEXT,
  linkedin_endorsements JSONB DEFAULT '[]'::jsonb,
  linkedin_recommendations INTEGER DEFAULT 0,
  linkedin_connections INTEGER DEFAULT 0,
  
  -- Personal website
  website_url TEXT,
  website_has_blog BOOLEAN DEFAULT false,
  website_tech_stack TEXT[],
  website_quality_score DECIMAL(3,1),
  
  -- AI-generated analysis
  overall_quality_score DECIMAL(3,1),
  quality_rating VARCHAR(20),
  strengths TEXT[],
  concerns TEXT[],
  style_description TEXT,
  best_work_summary TEXT,
  ai_recommendation TEXT,
  
  -- Portfolio screenshots/cache
  screenshots JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  cache_expires_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  analysis_version VARCHAR(10) DEFAULT '1.0',
  
  UNIQUE(candidate_id)
);

-- Portfolio scrape logs: Track scraping activity
CREATE TABLE IF NOT EXISTS portfolio_scrape_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  portfolio_type VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  response_time_ms INTEGER,
  scraped_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolio_analyses_candidate 
  ON portfolio_analyses(candidate_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_analyses_org 
  ON portfolio_analyses(org_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_analyses_quality 
  ON portfolio_analyses(overall_quality_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_portfolio_analyses_cache 
  ON portfolio_analyses(cache_expires_at) 
  WHERE cache_expires_at > now();

CREATE INDEX IF NOT EXISTS idx_portfolio_scrape_logs_candidate 
  ON portfolio_scrape_logs(candidate_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_scrape_logs_status 
  ON portfolio_scrape_logs(status, scraped_at DESC);

-- Full-text search on AI analysis
CREATE INDEX IF NOT EXISTS idx_portfolio_analysis_search 
  ON portfolio_analyses USING gin(
    to_tsvector('english', 
      COALESCE(style_description, '') || ' ' || 
      COALESCE(best_work_summary, '') || ' ' || 
      COALESCE(ai_recommendation, '')
    )
  );

-- Add portfolio URL columns to candidates table if not exists
ALTER TABLE candidates 
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS portfolio_url TEXT,
  ADD COLUMN IF NOT EXISTS behance_url TEXT,
  ADD COLUMN IF NOT EXISTS dribbble_url TEXT;

-- Indexes for portfolio URLs
CREATE INDEX IF NOT EXISTS idx_candidates_github 
  ON candidates(github_url) WHERE github_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_portfolio 
  ON candidates(portfolio_url) WHERE portfolio_url IS NOT NULL;

-- Comments
COMMENT ON TABLE portfolio_analyses IS 'Scraped and analyzed portfolio data for candidates';
COMMENT ON TABLE portfolio_scrape_logs IS 'Audit log of portfolio scraping attempts';
COMMENT ON COLUMN portfolio_analyses.overall_quality_score IS 'AI-generated quality score (0.0-10.0)';
COMMENT ON COLUMN portfolio_analyses.cache_expires_at IS 'When to refresh portfolio data (default 30 days)';
COMMENT ON COLUMN portfolio_analyses.quality_rating IS 'Human-readable rating: Excellent, High, Medium, Low';
