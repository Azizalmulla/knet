import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit'
import { fetchBlobBufferAndType } from '@/lib/parse-cv'
import { jwtVerify } from '@/lib/esm-compat/jose'
import { generateEmbedding } from '@/lib/embeddings'
import mammoth from 'mammoth'
import OpenAI from 'openai'
import pdfParse from 'pdf-parse'

// Ensure @vercel/postgres has a connection string in local/prod
if (!process.env.POSTGRES_URL && process.env.DATABASE_URL) {
  process.env.POSTGRES_URL = process.env.DATABASE_URL
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60 // 60 seconds for Vision API calls

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface ParsedResult {
  text: string
  wordCount: number
  pageCount: number | null
  confidence: number | null
  contentType: string
}

function cleanText(input: string): string {
  try {
    return String(input || '')
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return input || ''
  }
}

function wordCount(text: string): number {
  try {
    return (text || '').trim().split(/\s+/).filter(Boolean).length
  } catch {
    return 0
  }
}

function avg(numbers: number[]): number | null {
  if (!numbers || numbers.length === 0) return null
  const s = numbers.reduce((a, b) => a + b, 0)
  return s / numbers.length
}

async function parseWithGPTVision(buffer: Buffer, contentType: string): Promise<ParsedResult> {
  const lowerMime = String(contentType || '').toLowerCase()
  let parsedText = ''
  let pageCount: number | null = null
  let confidence: number | null = null
  
  // Handle DOCX with Mammoth first
  const looksLikeDocx = lowerMime.includes('officedocument.wordprocessingml.document') || 
                        lowerMime.includes('docx') || 
                        buffer.slice(0, 2).toString('utf8') === 'PK'
  
  if (looksLikeDocx) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      parsedText = cleanText(result.value || '')
      const tokens = wordCount(parsedText)
      console.log('[PARSE] DOCX parsed with Mammoth')
      return {
        text: parsedText,
        wordCount: tokens,
        pageCount: null,
        confidence: null,
        contentType
      }
    } catch (docxErr: any) {
      console.warn('[PARSE] Mammoth failed:', docxErr?.message)
      throw new Error('Failed to parse DOCX file')
    }
  }

  // Handle PDF files
  // Try pdf-parse first (for text-based PDFs)
  try {
    const pdfData = await pdfParse(buffer)
    parsedText = cleanText(pdfData.text || '')
    pageCount = pdfData.numpages || null
    
    // If pdf-parse extracted very little text, the PDF might be image-based
    // Fall back to GPT Vision
    if (parsedText.length < 100) {
      console.log('[PARSE] PDF appears to be image-based, using GPT Vision')
      throw new Error('PDF appears to be image-based')
    }
    
    console.log(`[PARSE] PDF parsed with pdf-parse: ${parsedText.length} chars, ${pageCount} pages`)
  } catch (pdfErr: any) {
    // PDF is likely image-based or corrupted, use GPT Vision
    console.log('[PARSE] Using GPT Vision for OCR:', pdfErr?.message)

    try {
      // Convert PDF to base64 and send to GPT Vision
      const imageBase64 = buffer.toString('base64')
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Latest vision model
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract ALL text content from this CV/Resume document. Return the raw text exactly as it appears, preserving structure and formatting. Include all sections: personal info, education, experience, skills, projects, etc.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${imageBase64}`,
                detail: "high" // Better OCR accuracy
              }
            }
          ]
        }],
        max_tokens: 4000,
        temperature: 0 // Deterministic
      })

      parsedText = cleanText(response.choices[0]?.message?.content || '')
      confidence = 0.95 // GPT Vision is highly accurate
      
      console.log(`[PARSE] GPT Vision OCR complete: ${parsedText.length} chars`)
    } catch (visionErr: any) {
      console.error('[PARSE] GPT Vision failed:', visionErr?.message)
      throw new Error(`Vision API failed: ${visionErr?.message || 'Unknown error'}`)
    }
  }

  if (!parsedText || parsedText.length < 50) {
    throw new Error('Extracted text is too short or empty')
  }

  const tokens = wordCount(parsedText)

  return {
    text: parsedText,
    wordCount: tokens,
    pageCount: pageCount,
    confidence,
    contentType
  }
}

async function authorize(request: NextRequest, orgSlug: string): Promise<boolean> {
  // Allow internal server-to-server calls
  const internal = (request.headers.get('x-internal-token') || '').trim()
  const allowedInternal = (process.env.INTERNAL_API_TOKEN || '').trim()
  if (internal && allowedInternal && internal === allowedInternal) return true

  // Allow admin cookies (per-org JWT)
  try {
    const token = request.cookies.get('admin_session')?.value || ''
    if (!token) return false
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production')
    const { payload } = await jwtVerify(token, secret)
    const tokenOrgSlug = String((payload as any)?.orgSlug || '')
    return tokenOrgSlug === orgSlug
  } catch {
    return false
  }
}

export async function POST(request: NextRequest, { params }: { params: { org: string; id: string } }) {
  const started = Date.now()
  const orgSlug = params.org
  const candidateId = params.id

  // Rate limit
  const rl = checkRateLimitWithConfig(request, { maxRequests: 20, windowMs: 60_000, namespace: `parse:${orgSlug}` })
  if (!rl.success) return createRateLimitResponse(rl)

  try {
    if (!(await authorize(request, orgSlug))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!candidateId) return NextResponse.json({ error: 'Missing candidateId' }, { status: 400 })

    // Resolve org and candidate
    const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
    if (!orgRes.rows.length) return NextResponse.json({ error: 'Org not found' }, { status: 404 })
    const orgId = orgRes.rows[0].id as string

    const cRes = await sql`
      SELECT c.id::uuid as id, c.org_id::uuid as org_id, COALESCE(c.cv_blob_key,'') as cv_blob_key, c.parse_status::text as parse_status
      FROM candidates c
      WHERE c.id = ${candidateId}::uuid AND c.org_id = ${orgId}::uuid AND c.deleted_at IS NULL
      LIMIT 1
    `
    if (!cRes.rows.length) return NextResponse.json({ error: 'Candidate not found' }, { status: 404 })
    const row = cRes.rows[0] as any
    const key: string = row.cv_blob_key
    if (!key) return NextResponse.json({ error: 'No CV file' }, { status: 400 })

    // Mark processing (best effort)
    try { 
      await sql`UPDATE candidates SET parse_status = 'processing'::parse_status_enum, updated_at = now() WHERE id = ${candidateId}::uuid AND org_id = ${orgId}::uuid` 
      console.log(`[PARSE] Marked ${candidateId} as processing`)
    } catch (e: any) {
      console.error(`[PARSE] Failed to mark processing:`, e?.message)
    }

    const blobToken = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN
    if (!blobToken) {
      console.error('[PARSE] BLOB token missing')
      return NextResponse.json({ error: 'BLOB_NOT_CONFIGURED' }, { status: 500 })
    }

    // Fetch and parse
    console.log(`[PARSE] Fetching blob for key: ${key}`)
    const { buffer, contentType } = await fetchBlobBufferAndType(key, blobToken!)
    console.log(`[PARSE] Fetched ${buffer.length} bytes, type: ${contentType}`)
    const parsed = await parseWithGPTVision(buffer, contentType)
    console.log(`[PARSE] Parsed: ${parsed.wordCount} words, ${parsed.pageCount} pages, confidence: ${parsed.confidence}`)

    // Sanitize text for PostgreSQL (remove null bytes and control characters)
    const sanitizedText = parsed.text
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \n, \r, \t
      .trim()
    
    console.log(`[PARSE] Sanitized text: ${sanitizedText.length} chars (was ${parsed.text.length})`)

    // Upsert into cv_analysis (with confidence score from Document AI)
    await sql`
      INSERT INTO cv_analysis (candidate_id, org_id, extracted_text, page_count, word_count, created_at)
      VALUES (${candidateId}::uuid, ${orgId}::uuid, ${sanitizedText}, ${parsed.pageCount || null}, ${parsed.wordCount}, now())
      ON CONFLICT (candidate_id) DO UPDATE SET
        extracted_text = EXCLUDED.extracted_text,
        page_count = EXCLUDED.page_count,
        word_count = EXCLUDED.word_count
    `
    console.log(`[PARSE] Stored cv_analysis for ${candidateId} (confidence: ${parsed.confidence})`)

    // Generate and store embedding for semantic search
    try {
      console.log(`[PARSE] Generating embedding for ${candidateId}`)
      const embeddingResult = await generateEmbedding(sanitizedText)
      if (embeddingResult) {
        // Convert array to pgvector format: [1,2,3] -> '[1,2,3]'
        const vectorString = `[${embeddingResult.embedding.join(',')}]`
        await sql`
          INSERT INTO candidate_embeddings (candidate_id, org_id, embedding, model, created_at)
          VALUES (${candidateId}::uuid, ${orgId}::uuid, ${vectorString}::vector, ${embeddingResult.model}, now())
          ON CONFLICT (candidate_id) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            model = EXCLUDED.model,
            updated_at = now()
        `
        console.log(`[PARSE] Stored embedding for ${candidateId} (model: ${embeddingResult.model})`)
      } else {
        console.log(`[PARSE] Embedding generation skipped (OPENAI_API_KEY not set or failed)`)
      }
    } catch (embErr: any) {
      console.error(`[PARSE] Embedding storage failed:`, embErr?.message)
      // Don't fail the entire parse if embedding fails
    }

    // Mark completed
    await sql`UPDATE candidates SET parse_status = 'completed'::parse_status_enum, updated_at = now() WHERE id = ${candidateId}::uuid AND org_id = ${orgId}::uuid`
    console.log(`[PARSE] Marked ${candidateId} as completed`)

    const took = Date.now() - started
    return NextResponse.json({ ok: true, took_ms: took, word_count: parsed.wordCount, page_count: parsed.pageCount || null, confidence: parsed.confidence, content_type: parsed.contentType })
  } catch (e: any) {
    console.error(`[PARSE] Error:`, { message: e?.message, stack: e?.stack?.slice(0, 200) })
    // Mark failed
    try {
      const orgRes = await sql`SELECT id::uuid as id FROM organizations WHERE slug = ${orgSlug} LIMIT 1`
      if (orgRes.rows.length) {
        const orgId = orgRes.rows[0].id as string
        if (candidateId) {
          await sql`UPDATE candidates SET parse_status = 'failed'::parse_status_enum, updated_at = now() WHERE id = ${candidateId}::uuid AND org_id = ${orgId}::uuid`
        }
      }
    } catch {}
    return NextResponse.json({ error: 'PARSE_FAILED', message: String(e?.message || e) }, { status: 500 })
  }
}
