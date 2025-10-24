/**
 * Backfill embeddings for existing candidates
 * Generates embeddings for all candidates that have cv_analysis.extracted_text
 * but no candidate_embeddings entry
 */

import { sql } from '@vercel/postgres'
import { generateEmbedding } from '../lib/embeddings'

// Ensure database connection
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

interface CandidateRow {
  candidate_id: string
  org_id: string
  extracted_text: string
}

async function backfillEmbeddings() {
  console.log('[BACKFILL] Starting embedding backfill...')
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('[BACKFILL] OPENAI_API_KEY not set. Aborting.')
    process.exit(1)
  }

  try {
    // Find candidates with extracted text but no embedding
    const result = await sql`
      SELECT 
        a.candidate_id,
        a.org_id,
        a.extracted_text
      FROM cv_analysis a
      LEFT JOIN candidate_embeddings e ON e.candidate_id = a.candidate_id
      WHERE e.candidate_id IS NULL
        AND a.extracted_text IS NOT NULL
        AND LENGTH(a.extracted_text) > 50
      ORDER BY a.created_at DESC
    `

    const candidates = result.rows as CandidateRow[]
    console.log(`[BACKFILL] Found ${candidates.length} candidates without embeddings`)

    if (candidates.length === 0) {
      console.log('[BACKFILL] Nothing to backfill. All candidates have embeddings!')
      return
    }

    let successCount = 0
    let failCount = 0
    const batchSize = 5 // Process 5 at a time to avoid rate limits

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize)
      console.log(`[BACKFILL] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(candidates.length / batchSize)}...`)

      await Promise.all(
        batch.map(async (candidate) => {
          try {
            // Sanitize text (same as parse route)
            const sanitizedText = candidate.extracted_text
              .replace(/\0/g, '') // Remove null bytes
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
              .trim()
            
            // Generate embedding
            const embeddingResult = await generateEmbedding(sanitizedText)
            
            if (!embeddingResult) {
              console.error(`[BACKFILL] Failed to generate embedding for ${candidate.candidate_id}`)
              failCount++
              return
            }

            // Store in database
            const vectorString = `[${embeddingResult.embedding.join(',')}]`
            await sql`
              INSERT INTO candidate_embeddings (candidate_id, org_id, embedding, model, created_at)
              VALUES (
                ${candidate.candidate_id}::uuid,
                ${candidate.org_id}::uuid,
                ${vectorString}::vector,
                ${embeddingResult.model},
                NOW()
              )
              ON CONFLICT (candidate_id) DO UPDATE SET
                embedding = EXCLUDED.embedding,
                model = EXCLUDED.model,
                updated_at = NOW()
            `

            console.log(`[BACKFILL] ✓ Generated embedding for ${candidate.candidate_id}`)
            successCount++
          } catch (error: any) {
            console.error(`[BACKFILL] ✗ Error for ${candidate.candidate_id}:`, error?.message)
            failCount++
          }
        })
      )

      // Rate limit: wait 1 second between batches
      if (i + batchSize < candidates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log('\n[BACKFILL] Summary:')
    console.log(`  Total candidates: ${candidates.length}`)
    console.log(`  Success: ${successCount}`)
    console.log(`  Failed: ${failCount}`)
    console.log(`  Success rate: ${Math.round((successCount / candidates.length) * 100)}%`)
    
    if (successCount > 0) {
      const costEstimate = (successCount * 2000 * 0.00000002).toFixed(4) // ~2000 tokens avg, $0.02/1M
      console.log(`  Estimated cost: $${costEstimate}`)
    }

  } catch (error: any) {
    console.error('[BACKFILL] Fatal error:', error?.message)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  backfillEmbeddings()
    .then(() => {
      console.log('[BACKFILL] Complete!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('[BACKFILL] Failed:', error)
      process.exit(1)
    })
}

export { backfillEmbeddings }
