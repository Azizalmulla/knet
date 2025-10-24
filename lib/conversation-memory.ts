import { sql } from '@vercel/postgres';
import { generateQueryEmbedding } from './embeddings';

export interface ConversationSession {
  id: string;
  org_id: string;
  admin_email: string;
  title: string | null;
  summary: string | null;
  candidate_count: number;
  message_count: number;
  actions_taken: any[];
  started_at: Date;
  last_active_at: Date;
}

export interface ConversationMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  tool_calls?: any;
  tool_results?: any;
  metadata?: any;
  created_at: Date;
}

export interface ContextMemory {
  id: string;
  memory_type: string;
  content: string;
  related_candidates: string[];
  metadata: any;
  created_at: Date;
}

/**
 * Get or create active conversation session
 */
export async function getOrCreateSession(
  orgId: string,
  adminEmail: string
): Promise<string> {
  // Check for recent active session (last 24 hours)
  const recentSession = await sql`
    SELECT id::text
    FROM conversation_sessions
    WHERE org_id = ${orgId}::uuid
      AND admin_email = ${adminEmail}
      AND last_active_at > now() - interval '24 hours'
    ORDER BY last_active_at DESC
    LIMIT 1
  `;

  if (recentSession.rows.length > 0) {
    // Update last active
    await sql`
      UPDATE conversation_sessions
      SET last_active_at = now()
      WHERE id = ${recentSession.rows[0].id}::uuid
    `;
    return recentSession.rows[0].id;
  }

  // Create new session
  const newSession = await sql`
    INSERT INTO conversation_sessions (org_id, admin_email, title)
    VALUES (${orgId}::uuid, ${adminEmail}, 'New Conversation')
    RETURNING id::text
  `;

  return newSession.rows[0].id;
}

/**
 * Save message to conversation history
 */
export async function saveMessage(
  sessionId: string,
  orgId: string,
  adminEmail: string,
  role: 'user' | 'assistant' | 'system',
  message: string,
  toolCalls?: any,
  toolResults?: any,
  metadata?: any
): Promise<void> {
  await sql`
    INSERT INTO conversation_history (
      session_id, org_id, admin_email, role, message,
      tool_calls, tool_results, metadata
    )
    VALUES (
      ${sessionId}::uuid,
      ${orgId}::uuid,
      ${adminEmail},
      ${role},
      ${message},
      ${JSON.stringify(toolCalls || null)}::jsonb,
      ${JSON.stringify(toolResults || null)}::jsonb,
      ${JSON.stringify(metadata || {})}::jsonb
    )
  `;

  // Update session message count and last active
  await sql`
    UPDATE conversation_sessions
    SET 
      message_count = message_count + 1,
      last_active_at = now()
    WHERE id = ${sessionId}::uuid
  `;
}

/**
 * Get recent conversation history
 */
export async function getRecentMessages(
  sessionId: string,
  limit: number = 20
): Promise<ConversationMessage[]> {
  const result = await sql`
    SELECT 
      id::text,
      session_id::text,
      role,
      message,
      tool_calls,
      tool_results,
      metadata,
      created_at
    FROM conversation_history
    WHERE session_id = ${sessionId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result.rows.reverse() as ConversationMessage[]; // Oldest first
}

/**
 * Get all sessions for an admin
 */
export async function getUserSessions(
  orgId: string,
  adminEmail: string,
  limit: number = 10
): Promise<ConversationSession[]> {
  const result = await sql`
    SELECT 
      id::text,
      org_id::text,
      admin_email,
      title,
      summary,
      candidate_count,
      message_count,
      actions_taken,
      started_at,
      last_active_at
    FROM conversation_sessions
    WHERE org_id = ${orgId}::uuid
      AND admin_email = ${adminEmail}
    ORDER BY last_active_at DESC
    LIMIT ${limit}
  `;

  return result.rows as ConversationSession[];
}

/**
 * Save important context memory with embedding
 */
export async function saveContextMemory(
  orgId: string,
  adminEmail: string,
  sessionId: string | null,
  memoryType: string,
  content: string,
  relatedCandidates: string[] = [],
  metadata: any = {}
): Promise<void> {
  // Generate embedding for semantic search
  const embeddingData = await generateQueryEmbedding(content, 1);
  const embedding = embeddingData?.embedding || null;

  const vectorString = embedding ? `[${embedding.join(',')}]` : null;

  if (vectorString) {
    await sql`
      INSERT INTO context_memories (
        org_id, admin_email, session_id, memory_type,
        content, embedding, related_candidates, metadata
      )
      VALUES (
        ${orgId}::uuid,
        ${adminEmail},
        ${sessionId}::uuid,
        ${memoryType},
        ${content},
        ${vectorString}::vector,
        ${JSON.stringify(relatedCandidates)}::jsonb,
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
  } else {
    await sql`
      INSERT INTO context_memories (
        org_id, admin_email, session_id, memory_type,
        content, related_candidates, metadata
      )
      VALUES (
        ${orgId}::uuid,
        ${adminEmail},
        ${sessionId}::uuid,
        ${memoryType},
        ${content},
        ${JSON.stringify(relatedCandidates)}::jsonb,
        ${JSON.stringify(metadata)}::jsonb
      )
    `;
  }
}

/**
 * Search context memories by semantic similarity
 */
export async function searchMemories(
  orgId: string,
  adminEmail: string,
  query: string,
  limit: number = 5
): Promise<ContextMemory[]> {
  const embeddingData = await generateQueryEmbedding(query, 1);
  
  if (!embeddingData || !embeddingData.embedding) {
    // Fallback to text search
    const result = await sql`
      SELECT 
        id::text,
        memory_type,
        content,
        related_candidates,
        metadata,
        created_at
      FROM context_memories
      WHERE org_id = ${orgId}::uuid
        AND admin_email = ${adminEmail}
        AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return result.rows as ContextMemory[];
  }

  const vectorString = `[${embeddingData.embedding.join(',')}]`;

  const result = await sql`
    SELECT 
      id::text,
      memory_type,
      content,
      related_candidates,
      metadata,
      created_at,
      (embedding <=> ${vectorString}::vector) as distance
    FROM context_memories
    WHERE org_id = ${orgId}::uuid
      AND admin_email = ${adminEmail}
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `;

  return result.rows as ContextMemory[];
}

/**
 * Update session with AI-generated title and summary
 */
export async function updateSessionSummary(
  sessionId: string,
  title: string,
  summary: string
): Promise<void> {
  await sql`
    UPDATE conversation_sessions
    SET 
      title = ${title},
      summary = ${summary}
    WHERE id = ${sessionId}::uuid
  `;
}

/**
 * Record action taken (shortlist created, email sent, etc.)
 */
export async function recordAction(
  sessionId: string,
  action: any
): Promise<void> {
  await sql`
    UPDATE conversation_sessions
    SET actions_taken = actions_taken || ${JSON.stringify([action])}::jsonb
    WHERE id = ${sessionId}::uuid
  `;
}
