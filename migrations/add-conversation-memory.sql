-- Add conversation memory for AI Agent
-- Phase 2: Multi-Day Memory

-- Conversation sessions: High-level tracking of hiring conversations
CREATE TABLE IF NOT EXISTS conversation_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  summary TEXT,
  candidate_count INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  last_active_at TIMESTAMPTZ DEFAULT now()
);

-- Conversation history: Every message in every conversation
CREATE TABLE IF NOT EXISTS conversation_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  message TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Context memories: Important insights and decisions (with semantic search)
CREATE TABLE IF NOT EXISTS context_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_email VARCHAR(255) NOT NULL,
  session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL,
  memory_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  related_candidates JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_conv_sessions_org_admin 
  ON conversation_sessions(org_id, admin_email, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_sessions_active 
  ON conversation_sessions(last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_conv_history_session 
  ON conversation_history(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conv_history_org_time 
  ON conversation_history(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_memories_org_admin 
  ON context_memories(org_id, admin_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_context_memories_type 
  ON context_memories(memory_type, created_at DESC);

-- IVFFlat index for semantic search on context memories
CREATE INDEX IF NOT EXISTS idx_context_memories_embedding 
  ON context_memories USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search on conversation messages
CREATE INDEX IF NOT EXISTS idx_conv_history_message_fts 
  ON conversation_history USING gin(to_tsvector('english', message));

CREATE INDEX IF NOT EXISTS idx_context_memories_content_fts 
  ON context_memories USING gin(to_tsvector('english', content));

-- Update triggers
CREATE TRIGGER trg_touch_conversation_sessions BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Comments
COMMENT ON TABLE conversation_sessions IS 'High-level tracking of AI agent conversations';
COMMENT ON TABLE conversation_history IS 'Every message exchanged with the AI agent';
COMMENT ON TABLE context_memories IS 'Important insights, decisions, and preferences extracted from conversations';
COMMENT ON COLUMN context_memories.embedding IS 'Vector embedding for semantic similarity search';
COMMENT ON COLUMN context_memories.memory_type IS 'Types: decision, note, preference, shortlist_ref, insight';
