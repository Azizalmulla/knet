-- Migration: Add import_log table for tracking email and bulk imports
-- Run this in your Neon database console

CREATE TABLE IF NOT EXISTS import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL, -- 'email_import', 'csv_import', 'pdf_bulk_import'
  source_email TEXT, -- Email address that sent the CV (for email imports)
  candidate_count INTEGER NOT NULL DEFAULT 1,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB, -- Additional data like filename, IP, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_import_log_org_id ON import_log(org_id);
CREATE INDEX IF NOT EXISTS idx_import_log_created_at ON import_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_log_source ON import_log(source);

-- Add source column to candidates table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'candidates' AND column_name = 'source'
  ) THEN
    ALTER TABLE candidates ADD COLUMN source TEXT DEFAULT 'manual_upload';
  END IF;
END $$;

-- Add index for source
CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates(source);

COMMENT ON TABLE import_log IS 'Tracks all import operations (email, CSV, bulk PDF)';
COMMENT ON COLUMN import_log.source IS 'Type of import: email_import, csv_import, pdf_bulk_import';
COMMENT ON COLUMN import_log.source_email IS 'Email address of sender for email imports';
COMMENT ON COLUMN candidates.source IS 'How candidate was added: manual_upload, email_import, csv_import, student_portal';
