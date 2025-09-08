CREATE TABLE IF NOT EXISTS form_sessions (
  id TEXT PRIMARY KEY,
  form_data JSONB NOT NULL DEFAULT '{}',
  current_step INTEGER NOT NULL DEFAULT -1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_form_sessions_id ON form_sessions(id);

CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  form_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_session_id ON form_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON form_submissions(email);

-- Enable RLS on both tables
ALTER TABLE form_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for form_sessions
-- Allow users to create sessions (anonymous access for new sessions)
CREATE POLICY "Allow anonymous session creation" ON form_sessions
  FOR INSERT 
  WITH CHECK (true);

-- Allow users to read their own sessions using session ID
CREATE POLICY "Allow session read with valid id" ON form_sessions
  FOR SELECT 
  USING (id = current_setting('request.headers')::json->>'x-session-id');

-- Allow users to update their own sessions using session ID  
CREATE POLICY "Allow session update with valid id" ON form_sessions
  FOR UPDATE 
  USING (id = current_setting('request.headers')::json->>'x-session-id')
  WITH CHECK (id = current_setting('request.headers')::json->>'x-session-id');

-- Allow users to delete their own sessions using session ID
CREATE POLICY "Allow session delete with valid id" ON form_sessions
  FOR DELETE 
  USING (id = current_setting('request.headers')::json->>'x-session-id');

-- RLS Policies for form_submissions  
-- Allow submission creation with valid session ID
CREATE POLICY "Allow submission creation with valid session" ON form_submissions
  FOR INSERT 
  WITH CHECK (
    session_id = current_setting('request.headers')::json->>'x-session-id' AND
    EXISTS (
      SELECT 1 FROM form_sessions 
      WHERE id = form_submissions.session_id 
      AND expires_at > NOW()
    )
  );

-- Allow reading submissions with valid session ID
CREATE POLICY "Allow submission access with valid session" ON form_submissions
  FOR SELECT 
  USING (session_id = current_setting('request.headers')::json->>'x-session-id');
