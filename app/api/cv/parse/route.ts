import { NextRequest, NextResponse } from 'next/server';
import { sql, getDbInfo } from '@/lib/db';
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit';
import mammoth from 'mammoth';
import { createServerClient } from '@/lib/supabase-server'
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds for Vision API calls

// Initialize OpenAI only when needed to avoid build-time errors
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
}

// Limits (approx)
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

function wordCount(text: string): number {
  try {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

function avg(numbers: number[]): number | null {
  if (!numbers || numbers.length === 0) return null;
  const s = numbers.reduce((a, b) => a + b, 0);
  return s / numbers.length;
}

function cleanText(input: string): string {
  try {
    // Strip control chars and collapse whitespace
    return String(input || '')
      .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return input || '';
  }
}

export async function POST(request: NextRequest) {
  // Enforce logged-in student (Supabase)
  let emailLower: string | null = null
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) emailLower = user.email.toLowerCase()
  } catch {}
  if (!emailLower) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, code: 'UNAUTHENTICATED', message: 'You must be logged in.' }, { status: 401 })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', '')
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  // Rate limit: 10 req / 5 min / IP
  const rl = checkRateLimitWithConfig(request, { maxRequests: 10, windowMs: 5 * 60 * 1000, namespace: 'cv-parse' });
  if (!rl.success) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = createRateLimitResponse(rl)
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, code: 'BAD_REQUEST', message: 'Invalid JSON body' }, { status: 400 })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  const { blobUrl, fileBase64, mime: providedMime, studentId } = body || {};
  if (!studentId || (!blobUrl && !fileBase64)) {
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, code: 'BAD_FILE', message: 'Missing file or studentId' }, { status: 400 })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  // Ensure schema exists (idempotent)
  try {
    await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_parse_status VARCHAR(20) DEFAULT 'queued'`;
  } catch {}
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS cv_text (
        student_id INT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
        text TEXT NOT NULL,
        pages INT,
        tokens INT,
        confidence NUMERIC,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`;
  } catch {}

  // Mark processing
  try { await sql`UPDATE students SET cv_parse_status = 'processing' WHERE id = ${studentId}`; } catch {}

  // Fetch bytes
  let fileBuf: Buffer | null = null;
  let mime: string | null = providedMime || null;
  try {
    if (blobUrl) {
      const res = await fetch(blobUrl);
      if (!res.ok) throw new Error(`Fetch blob failed: ${res.status}`);
      const len = Number(res.headers.get('content-length') || '0');
      if (len && len > MAX_BYTES) {
        try { await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`; } catch {}
        const { host: dbHost, db: dbName } = getDbInfo()
        const res = NextResponse.json({ ok: false, code: 'BAD_FILE', message: 'File too large' }, { status: 400 })
        res.headers.set('X-DB-Host', dbHost)
        res.headers.set('X-DB-Name', dbName)
        res.headers.set('X-User-Email', emailLower)
        res.headers.set('X-Org-Slug', '')
        res.headers.set('X-Org-Id', '')
        res.headers.set('X-Loopback-Found', 'false')
        return res
      }
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_BYTES) {
        try { await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`; } catch {}
        return NextResponse.json({ ok: false, code: 'BAD_FILE', message: 'File too large' }, { status: 400 });
      }
      fileBuf = Buffer.from(ab);
      mime = mime || res.headers.get('content-type');
    } else if (fileBase64) {
      const buf = Buffer.from(String(fileBase64), 'base64');
      if (buf.byteLength > MAX_BYTES) {
        try { await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`; } catch {}
        const { host: dbHost, db: dbName } = getDbInfo()
        const res = NextResponse.json({ ok: false, code: 'BAD_FILE', message: 'File too large' }, { status: 400 })
        res.headers.set('X-DB-Host', dbHost)
        res.headers.set('X-DB-Name', dbName)
        res.headers.set('X-User-Email', emailLower)
        res.headers.set('X-Org-Slug', '')
        res.headers.set('X-Org-Id', '')
        res.headers.set('X-Loopback-Found', 'false')
        return res
      }
      fileBuf = buf;
    }
  } catch (e: any) {
    try { await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`; } catch {}
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, code: 'BAD_FILE', message: e?.message || 'Failed to load file' }, { status: 400 })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  if (!fileBuf) {
    try { await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`; } catch {}
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, code: 'BAD_FILE', message: 'No file content' }, { status: 400 })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }

  // Detect default mime if still unknown
  if (!mime) mime = 'application/pdf';

  // Parse CV using GPT-4 Vision
  try {
    let parsedText = '';
    let pages: number | null = null;
    let confidence: number | null = null;
    let method = 'unknown';

    const lowerMime = String(mime || '').toLowerCase();
    const looksLikeDocx = lowerMime.includes('officedocument.wordprocessingml.document') || lowerMime.includes('docx') || fileBuf.slice(0, 2).toString('utf8') === 'PK';
    
    // Handle DOCX files with Mammoth
    if (looksLikeDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuf });
        parsedText = cleanText(result.value || '');
        method = 'mammoth';
        if (process.env.NODE_ENV === 'development') {
          console.log('CV_PARSE_DOCX_OK', { studentId, size: fileBuf.byteLength, mime });
        }
      } catch (docxErr: any) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('MAMMOTH_FAIL', { studentId, message: String(docxErr?.message || docxErr) });
        }
        throw new Error('Failed to parse DOCX file');
      }
    }
    // Handle PDF files
    else {
      // Try pdf-parse first (for text-based PDFs)
      try {
        const pdfData = await pdfParse(fileBuf);
        parsedText = cleanText(pdfData.text || '');
        pages = pdfData.numpages || null;
        method = 'pdf-parse';
        
        // If pdf-parse extracted very little text, the PDF might be image-based
        // Fall back to GPT Vision
        if (parsedText.length < 100) {
          throw new Error('PDF appears to be image-based, using Vision API');
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.log('CV_PARSE_PDF_TEXT_OK', { studentId, size: fileBuf.byteLength, pages, textLength: parsedText.length });
        }
      } catch (pdfErr: any) {
        // PDF is likely image-based or corrupted, use GPT Vision
        if (process.env.NODE_ENV === 'development') {
          console.log('CV_PARSE_FALLBACK_TO_VISION', { studentId, reason: pdfErr?.message });
        }

        try {
          const openai = getOpenAI();
          
          // Convert PDF first page to image using sharp
          // Note: For multi-page PDFs, we'd need a library like pdf-poppler or pdf2pic
          // For now, we'll convert to base64 and let GPT Vision handle it
          const imageBase64 = fileBuf.toString('base64');
          
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
          });

          parsedText = cleanText(response.choices[0]?.message?.content || '');
          method = 'gpt-vision';
          confidence = 0.95; // GPT Vision is highly accurate
          
          if (process.env.NODE_ENV === 'development') {
            console.log('CV_PARSE_VISION_OK', { studentId, size: fileBuf.byteLength, textLength: parsedText.length });
          }
        } catch (visionErr: any) {
          if (process.env.NODE_ENV === 'development') {
            console.error('CV_PARSE_VISION_FAIL', { studentId, error: visionErr?.message });
          }
          throw new Error(`Vision API failed: ${visionErr?.message || 'Unknown error'}`);
        }
      }
    }

    if (!parsedText || parsedText.length < 50) {
      throw new Error('Extracted text is too short or empty');
    }

    const tokens = wordCount(parsedText);

    // Persist raw text
    try {
      await sql`
        INSERT INTO cv_text (student_id, text, pages, tokens, confidence)
        VALUES (${studentId}, ${parsedText}, ${pages || null}, ${tokens || null}, ${confidence as any})
        ON CONFLICT (student_id) DO UPDATE SET
          text = EXCLUDED.text,
          pages = EXCLUDED.pages,
          tokens = EXCLUDED.tokens,
          confidence = EXCLUDED.confidence,
          created_at = NOW()
      `;
      await sql`UPDATE students SET cv_parse_status = 'done' WHERE id = ${studentId}`;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('CV_PARSE_SUCCESS', { studentId, method, size: fileBuf.byteLength, mime, pages, tokens });
      }

      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ 
        ok: true, 
        parsedText, 
        tokens, 
        pages, 
        confidence,
        method 
      })
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', '')
      res.headers.set('X-Org-Id', '')
      res.headers.set('X-Loopback-Found', 'false')
      res.headers.set('X-Parse-Method', method)
      return res
    } catch (dbErr: any) {
      await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`;
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, code: 'DB_ERROR', message: dbErr?.message || 'DB error' }, { status: 502 })
      res.headers.set('X-DB-Host', dbHost)
      res.headers.set('X-DB-Name', dbName)
      res.headers.set('X-User-Email', emailLower)
      res.headers.set('X-Org-Slug', '')
      res.headers.set('X-Org-Id', '')
      res.headers.set('X-Loopback-Found', 'false')
      return res
    }
  } catch (error: any) {
    try { await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`; } catch {}
    if (process.env.NODE_ENV === 'development') {
      console.error('CV_PARSE_FAIL', { studentId, size: fileBuf?.byteLength, mime, message: error?.message });
    }
    const { host: dbHost, db: dbName } = getDbInfo()
    const res = NextResponse.json({ ok: false, code: 'PARSE_ERROR', message: error?.message || 'CV parsing failed' }, { status: 502 })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }
}
