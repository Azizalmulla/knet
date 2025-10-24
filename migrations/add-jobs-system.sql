-- Jobs System - Phase 1: Basic Job Board
-- Allows companies to post jobs and candidates to apply

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Job details
  title VARCHAR(255) NOT NULL,
  department VARCHAR(100),
  location VARCHAR(255),
  job_type VARCHAR(50), -- full-time, part-time, contract, internship
  work_mode VARCHAR(50), -- remote, onsite, hybrid
  
  -- Salary
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency VARCHAR(10) DEFAULT 'KWD',
  
  -- Content
  description TEXT NOT NULL,
  requirements TEXT,
  responsibilities TEXT,
  benefits TEXT,
  skills TEXT[], -- Array of required skills
  
  -- Status
  status VARCHAR(50) DEFAULT 'open', -- open, closed, filled, draft
  
  -- Metadata
  created_by VARCHAR(255) NOT NULL, -- admin email
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  hired_candidate_id UUID REFERENCES candidates(id),
  
  -- SEO
  slug VARCHAR(255) UNIQUE,
  
  -- Stats
  view_count INTEGER DEFAULT 0,
  application_count INTEGER DEFAULT 0
);

-- Job applications
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Application content
  cover_letter TEXT,
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'applied', -- applied, reviewing, interview, offer, rejected, hired, withdrawn
  
  -- Metadata
  applied_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255), -- admin email
  notes TEXT, -- Admin notes
  
  -- Prevent duplicate applications
  UNIQUE(job_id, candidate_id)
);

-- Job views tracking (for analytics)
CREATE TABLE IF NOT EXISTS job_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Saved jobs (candidates can save for later)
CREATE TABLE IF NOT EXISTS saved_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, candidate_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_org ON jobs(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_jobs_slug ON jobs(slug);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_applications_job ON job_applications(job_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_candidate ON job_applications(candidate_id, applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_status ON job_applications(status, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_views_job ON job_views(job_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_jobs_candidate ON saved_jobs(candidate_id, saved_at DESC);

-- Full-text search on jobs
CREATE INDEX IF NOT EXISTS idx_jobs_search ON jobs USING gin(
  to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(description, '') || ' ' || 
    COALESCE(requirements, '') || ' ' ||
    COALESCE(array_to_string(skills, ' '), '')
  )
);

-- Function to auto-update application count
CREATE OR REPLACE FUNCTION update_job_application_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs SET application_count = application_count + 1 WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE jobs SET application_count = application_count - 1 WHERE id = OLD.job_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_application_count
AFTER INSERT OR DELETE ON job_applications
FOR EACH ROW EXECUTE FUNCTION update_job_application_count();

-- Function to generate slug from title
CREATE OR REPLACE FUNCTION generate_job_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_job_slug
BEFORE INSERT ON jobs
FOR EACH ROW EXECUTE FUNCTION generate_job_slug();

-- Comments
COMMENT ON TABLE jobs IS 'Job postings created by organizations';
COMMENT ON TABLE job_applications IS 'Candidate applications to jobs';
COMMENT ON TABLE job_views IS 'Analytics tracking for job views';
COMMENT ON TABLE saved_jobs IS 'Jobs saved by candidates for later';

COMMENT ON COLUMN jobs.status IS 'open: accepting applications, closed: no longer accepting, filled: position filled, draft: not published';
COMMENT ON COLUMN job_applications.status IS 'Hiring pipeline status: applied → reviewing → interview → offer → hired/rejected';
