-- Role templates table for saving common job searches
CREATE TABLE IF NOT EXISTS role_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  must_have_skills TEXT[], -- Array of required skills
  nice_to_have_skills TEXT[], -- Array of nice-to-have skills
  min_years INTEGER DEFAULT 0,
  language VARCHAR(100),
  location VARCHAR(255),
  department VARCHAR(100), -- For department-based access
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Candidate status tracking table
CREATE TABLE IF NOT EXISTS candidate_status (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES cvs(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('shortlisted', 'rejected', 'pending', 'interviewed', 'hired')),
  reason VARCHAR(500), -- Reason for rejection or notes
  role_title VARCHAR(255), -- Which role this status is for
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, role_title) -- One status per student per role
);

-- CV embeddings table for semantic search
CREATE TABLE IF NOT EXISTS cv_embeddings (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES cvs(id) ON DELETE CASCADE UNIQUE,
  embedding VECTOR(1536), -- OpenAI ada-002 embeddings are 1536 dimensions
  parsed_text TEXT, -- The text that was embedded
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates for candidate communication
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('shortlist', 'reject', 'interview', 'offer')),
  subject VARCHAR(500),
  body TEXT,
  variables TEXT[], -- Available variables like {name}, {role}, etc.
  department VARCHAR(100),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin departments for access control
CREATE TABLE IF NOT EXISTS admin_departments (
  id SERIAL PRIMARY KEY,
  admin_email VARCHAR(255) NOT NULL UNIQUE,
  department VARCHAR(100) NOT NULL,
  fields_of_study TEXT[], -- Which fields this admin can access
  permissions TEXT[] DEFAULT ARRAY['view', 'rank', 'export'], -- Granular permissions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_templates_department ON role_templates(department);
CREATE INDEX IF NOT EXISTS idx_candidate_status_student ON candidate_status(student_id);
CREATE INDEX IF NOT EXISTS idx_candidate_status_role ON candidate_status(role_title);
CREATE INDEX IF NOT EXISTS idx_cv_embeddings_student ON cv_embeddings(student_id);
