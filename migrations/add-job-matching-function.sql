-- Function to match candidates to a job using vector similarity
-- This uses pgvector extension for semantic similarity search

CREATE OR REPLACE FUNCTION match_candidates_to_job(
  job_embedding vector(1536),
  org_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  field_of_study text,
  years_of_experience text,
  gpa numeric,
  cv_url text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.full_name,
    c.email,
    c.phone,
    c.field_of_study,
    c.years_of_experience,
    c.gpa,
    c.cv_url,
    1 - (e.embedding <=> job_embedding) as similarity
  FROM candidates c
  INNER JOIN candidate_embeddings e ON c.id = e.candidate_id
  WHERE c.organization_id = org_id
    AND (1 - (e.embedding <=> job_embedding)) >= match_threshold
  ORDER BY e.embedding <=> job_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION match_candidates_to_job TO authenticated;

-- Comment
COMMENT ON FUNCTION match_candidates_to_job IS 
'Matches candidates to a job posting using vector similarity search. Returns top candidates ranked by semantic match score.';
