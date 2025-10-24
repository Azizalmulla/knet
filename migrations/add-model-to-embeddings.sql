-- Add model column to candidate_embeddings table
-- This stores which OpenAI model was used to generate the embedding
-- (e.g., 'text-embedding-3-small', 'text-embedding-3-large')

ALTER TABLE candidate_embeddings 
ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'text-embedding-3-small';

-- Add index for model filtering (optional, but useful for analytics)
CREATE INDEX IF NOT EXISTS idx_candidate_embeddings_model ON candidate_embeddings(model);

-- Update existing rows to have the default model
UPDATE candidate_embeddings 
SET model = 'text-embedding-3-small' 
WHERE model IS NULL;

-- Comment for reference
COMMENT ON COLUMN candidate_embeddings.model IS 'OpenAI embedding model used (e.g., text-embedding-3-small)';
