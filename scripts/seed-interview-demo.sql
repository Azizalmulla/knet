-- Quick seed script for STC Demo
-- Run this in Neon to set up demo data

-- Step 1: Create a demo interview template
INSERT INTO interview_templates (org_id, title, description, status, created_at)
VALUES (
  (SELECT id FROM organizations WHERE slug = 'knet' LIMIT 1),
  'Software Engineer Interview - STC',
  'Technical interview for software engineering positions at STC',
  'active',
  now()
)
RETURNING id;

-- Get the template ID (replace with actual UUID after running above)
-- For this example, let's call it TEMPLATE_ID

-- Step 2: Add interview questions
INSERT INTO interview_questions (template_id, question_text, question_type, time_limit_seconds, order_index)
VALUES
  (
    'TEMPLATE_ID',  -- Replace with actual UUID
    'Tell me about your experience with building scalable web applications. What technologies have you worked with?',
    'video',
    120,
    1
  ),
  (
    'TEMPLATE_ID',  -- Replace with actual UUID
    'Describe a challenging technical problem you solved recently. What was your approach?',
    'video',
    120,
    2
  ),
  (
    'TEMPLATE_ID',  -- Replace with actual UUID
    'How do you ensure code quality and maintainability in your projects? What tools and practices do you use?',
    'video',
    120,
    3
  );

-- Step 3: Create interview sessions for existing candidates
-- (This will let you test the system with real candidates from your database)

-- Get 3 candidates from KNET org
WITH demo_candidates AS (
  SELECT id, full_name
  FROM candidates
  WHERE org_id = (SELECT id FROM organizations WHERE slug = 'knet' LIMIT 1)
  LIMIT 3
)
INSERT INTO interview_sessions (org_id, template_id, candidate_id, status, expires_at)
SELECT
  (SELECT id FROM organizations WHERE slug = 'knet' LIMIT 1),
  'TEMPLATE_ID',  -- Replace with actual UUID
  id,
  'pending',
  now() + INTERVAL '30 days'
FROM demo_candidates
RETURNING id, candidate_id;

-- The interview URLs will be: https://your-domain.com/interview/[session-id]

-- Quick verification query
SELECT
  s.id as session_id,
  c.full_name as candidate,
  c.email,
  t.title as interview,
  s.status,
  s.expires_at
FROM interview_sessions s
JOIN candidates c ON c.id = s.candidate_id
JOIN interview_templates t ON t.id = s.template_id
WHERE t.title LIKE '%STC%'
ORDER BY s.created_at DESC;
