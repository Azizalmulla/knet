-- Inbox system for multi-tenant email-like messaging
-- Each org has isolated inbox; admins see only their org's messages

CREATE TABLE IF NOT EXISTS inbox_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inbox_threads_org ON inbox_threads(organization_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_candidate ON inbox_threads(candidate_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread ON inbox_messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_inbox_threads_unread ON inbox_threads(organization_id, unread_count) WHERE unread_count > 0;

-- Function to update thread timestamp and unread count
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

CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON inbox_messages
FOR EACH ROW
EXECUTE FUNCTION update_inbox_thread_on_message();

-- Function to decrement unread count when message is marked read
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

CREATE TRIGGER trigger_update_thread_on_read
AFTER UPDATE ON inbox_messages
FOR EACH ROW
WHEN (OLD.is_read IS DISTINCT FROM NEW.is_read)
EXECUTE FUNCTION update_inbox_thread_on_read();
