-- Run this in your Neon SQL console to verify and setup inbox tables
-- This is safe to run multiple times (uses IF NOT EXISTS)

-- 1. Verify tables exist
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inbox_threads') 
    THEN '✅ inbox_threads exists'
    ELSE '❌ inbox_threads missing'
  END AS threads_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inbox_messages') 
    THEN '✅ inbox_messages exists'
    ELSE '❌ inbox_messages missing'
  END AS messages_status;

-- 2. Create tables if they don't exist (copy from add-inbox-system.sql)
CREATE TABLE IF NOT EXISTS inbox_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
  
  -- Thread metadata
  subject TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT NOT NULL,
  
  -- Status
  is_archived BOOLEAN DEFAULT FALSE,
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
  
  -- Message content
  from_type TEXT NOT NULL CHECK (from_type IN ('admin', 'candidate')),
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_inbox_threads_org ON inbox_threads(organization_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_candidate ON inbox_threads(candidate_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread ON inbox_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_unread ON inbox_threads(organization_id, unread_count) WHERE unread_count > 0;

-- 4. Create triggers
CREATE OR REPLACE FUNCTION update_inbox_thread_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inbox_threads
  SET 
    last_message_at = NEW.created_at,
    unread_count = CASE 
      WHEN NEW.from_type = 'candidate' AND NEW.is_read = FALSE 
      THEN unread_count + 1 
      ELSE unread_count 
    END,
    updated_at = now()
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_on_message ON inbox_messages;
CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON inbox_messages
FOR EACH ROW
EXECUTE FUNCTION update_inbox_thread_on_message();

CREATE OR REPLACE FUNCTION update_inbox_thread_on_read()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_read = FALSE AND NEW.is_read = TRUE AND NEW.from_type = 'candidate' THEN
    UPDATE inbox_threads
    SET unread_count = GREATEST(0, unread_count - 1)
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_thread_on_read ON inbox_messages;
CREATE TRIGGER trigger_update_thread_on_read
AFTER UPDATE ON inbox_messages
FOR EACH ROW
WHEN (OLD.is_read IS DISTINCT FROM NEW.is_read)
EXECUTE FUNCTION update_inbox_thread_on_read();

-- 5. Final verification
SELECT 
  '✅ Setup complete!' as status,
  COUNT(*) as thread_count 
FROM inbox_threads;
