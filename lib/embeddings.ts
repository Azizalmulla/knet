/**
 * OpenAI Embeddings utility for semantic similarity
 * Uses text-embedding-3-small for cost-effective, high-quality embeddings
 */

export interface EmbeddingResult {
  embedding: number[]
  model: string
  usage: number
}

// Simple in-memory cache for query embeddings
interface CacheEntry {
  result: EmbeddingResult
  expiresAt: number
}

const embeddingCache = new Map<string, CacheEntry>()

// Clean expired cache entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of embeddingCache.entries()) {
    if (entry.expiresAt < now) {
      embeddingCache.delete(key)
    }
  }
}, 60000) // Clean every minute

/**
 * Generate embedding for text using OpenAI (no caching)
 * Use this for CV embeddings that should be stored permanently
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  if (!text || text.trim().length === 0) return null
  if (!process.env.OPENAI_API_KEY) return null

  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // 1536 dimensions, ~$0.02/1M tokens
      input: text.slice(0, 8000), // Limit to ~8k chars for safety
      encoding_format: 'float',
    })

    return {
      embedding: response.data[0].embedding,
      model: response.model,
      usage: response.usage.total_tokens,
    }
  } catch (error: any) {
    console.error('[EMBEDDINGS] Generation failed:', error?.message)
    return null
  }
}

/**
 * Generate embedding for query with caching (TTL: 10 minutes)
 * Use this for admin search queries that may be repeated
 */
export async function generateQueryEmbedding(text: string, ttlMinutes: number = 10): Promise<EmbeddingResult | null> {
  if (!text || text.trim().length === 0) return null
  if (!process.env.OPENAI_API_KEY) return null

  // Create cache key (normalized query)
  const cacheKey = text.trim().toLowerCase()
  
  // Check cache
  const cached = embeddingCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    console.log('[EMBEDDINGS] Cache hit for query')
    return cached.result
  }

  // Generate new embedding
  console.log('[EMBEDDINGS] Cache miss, generating new embedding')
  const result = await generateEmbedding(text)
  
  if (result) {
    // Store in cache
    embeddingCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
    })
  }

  return result
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats() {
  const now = Date.now()
  let validEntries = 0
  let expiredEntries = 0
  
  for (const entry of embeddingCache.values()) {
    if (entry.expiresAt > now) {
      validEntries++
    } else {
      expiredEntries++
    }
  }

  return {
    totalEntries: embeddingCache.size,
    validEntries,
    expiredEntries,
    hitRateEstimate: validEntries > 0 ? Math.round((validEntries / (validEntries + 1)) * 100) : 0
  }
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 (opposite) and 1 (identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * Batch generate embeddings for multiple texts (more efficient)
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>()
  if (!process.env.OPENAI_API_KEY) return results

  try {
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Filter and truncate texts
    const validTexts = texts
      .filter(t => t && t.trim().length > 0)
      .map(t => t.slice(0, 8000))

    if (validTexts.length === 0) return results

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: validTexts,
      encoding_format: 'float',
    })

    response.data.forEach((item, index) => {
      results.set(validTexts[index], item.embedding)
    })

    return results
  } catch (error: any) {
    console.error('[EMBEDDINGS] Batch generation failed:', error?.message)
    return results
  }
}
