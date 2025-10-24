-- Seed a preview candidate with a cv_blob_key for presign E2E
-- Safe to re-run (checks by email)

-- 1) Ensure org 'careerly' exists (adjust slug as needed)
WITH upsert_org AS (
  INSERT INTO organizations (slug, name, is_public)
  VALUES ('careerly', 'Careerly', true)
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
), org_row AS (
  SELECT id FROM upsert_org
  UNION
  SELECT id FROM organizations WHERE slug = 'careerly' LIMIT 1
)
-- 2) Insert candidate if not exists
INSERT INTO candidates (
  org_id,
  full_name,
  email,
  phone,
  field_of_study,
  area_of_interest,
  degree,
  years_of_experience,
  cv_type,
  cv_blob_key,
  parse_status,
  created_at
)
SELECT
  (SELECT id FROM org_row) AS org_id,
  'E2E Preview Candidate' AS full_name,
  'preview.candidate@careerly.e2e' AS email,
  '' AS phone,
  'Computer Science' AS field_of_study,
  'Software Development' AS area_of_interest,
  'Bachelor' AS degree,
  '0-1'::yoe_bucket AS years_of_experience,
  'uploaded'::cv_type_enum AS cv_type,
  'preview/test-cv.pdf' AS cv_blob_key,
  'completed'::parse_status_enum AS parse_status,
  now() AS created_at
WHERE NOT EXISTS (
  SELECT 1 FROM candidates WHERE email = 'preview.candidate@careerly.e2e'
);
