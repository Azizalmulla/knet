-- Add inbox routing preferences to organizations table
-- This allows each org to choose how they want to handle email replies

DO $$ 
BEGIN
  -- Add inbox_mode column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'inbox_mode'
  ) THEN
    ALTER TABLE organizations 
    ADD COLUMN inbox_mode TEXT DEFAULT 'inbox_only' 
    CHECK (inbox_mode IN ('inbox_only', 'personal_email', 'both'));
  END IF;

  -- Add reply_from_inbox setting
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'enable_inbox_ui'
  ) THEN
    ALTER TABLE organizations 
    ADD COLUMN enable_inbox_ui BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN organizations.inbox_mode IS 
'inbox_only: All replies go to org inbox (knet@wathefni.ai)
personal_email: Replies go to admin personal email (BCC to inbox for tracking)
both: Reply-To is personal email, BCC inbox for tracking';

COMMENT ON COLUMN organizations.enable_inbox_ui IS 
'Whether to show the Inbox tab in admin dashboard';

-- Example: Set different orgs to different modes
-- UPDATE organizations SET inbox_mode = 'both' WHERE slug = 'knet';
-- UPDATE organizations SET inbox_mode = 'inbox_only' WHERE slug = 'nbk';
-- UPDATE organizations SET inbox_mode = 'personal_email' WHERE slug = 'gb';
