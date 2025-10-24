-- Fix conversation_sessions trigger error
-- The table uses 'last_active_at' not 'updated_at'

-- Drop the broken trigger
DROP TRIGGER IF EXISTS trg_touch_conversation_sessions ON conversation_sessions;

-- Create a custom trigger function for conversation_sessions
CREATE OR REPLACE FUNCTION touch_conversation_last_active()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_active_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that updates last_active_at instead of updated_at
CREATE TRIGGER trg_touch_conversation_sessions 
  BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW 
  EXECUTE FUNCTION touch_conversation_last_active();
