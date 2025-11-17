import { NextRequest, NextResponse } from 'next/server';
import { sql, getDbInfo } from '@/lib/db';
import { checkRateLimitWithConfig, createRateLimitResponse } from '@/lib/rateLimit';
import { v1 as documentai } from '@google-cloud/documentai';
import mammoth from 'mammoth';
import { createServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs';

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

  // Setup Document AI client
  try {
    // If DOCX, use Mammoth to extract text and bypass Document AI
    const lowerMime = String(mime || '').toLowerCase();
    const looksLikeDocx = lowerMime.includes('officedocument.wordprocessingml.document') || lowerMime.includes('docx') || fileBuf.slice(0, 2).toString('utf8') === 'PK';
    if (looksLikeDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: fileBuf });
        const parsedText = cleanText(result.value || '');
        const tokens = wordCount(parsedText);
        await sql`
          INSERT INTO cv_text (student_id, text, pages, tokens, confidence)
          VALUES (${studentId}, ${parsedText}, ${null}, ${tokens || null}, ${null})
          ON CONFLICT (student_id) DO UPDATE SET
            text = EXCLUDED.text,
            pages = EXCLUDED.pages,
            tokens = EXCLUDED.tokens,
            confidence = EXCLUDED.confidence,
            created_at = NOW()
        `;
        await sql`UPDATE students SET cv_parse_status = 'done' WHERE id = ${studentId}`;
        if (process.env.NODE_ENV === 'development') {
          console.log('CV_PARSE_DOCX_OK', { studentId, size: fileBuf.byteLength, mime });
        }
        {
          const { host: dbHost, db: dbName } = getDbInfo()
          const res = NextResponse.json({ ok: true, parsedText, tokens, pages: null, confidence: null })
          res.headers.set('X-DB-Host', dbHost)
          res.headers.set('X-DB-Name', dbName)
          res.headers.set('X-User-Email', emailLower)
          res.headers.set('X-Org-Slug', '')
          res.headers.set('X-Org-Id', '')
          res.headers.set('X-Loopback-Found', 'false')
          return res
        }
      } catch (docxErr: any) {
        // fall through to Document AI if Mammoth fails
        if (process.env.NODE_ENV === 'development') {
          console.warn('MAMMOTH_FAIL_FALLBACK_DAI', { studentId, message: String(docxErr?.message || docxErr) });
        }
      }
    }

    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '';
    const PROJECT_ID = process.env.DOC_AI_PROJECT_ID || process.env.PROJECT_ID || '';
    const LOCATION = process.env.DOC_AI_LOCATION || process.env.LOCATION || 'us';
    const PROCESSOR_ID = process.env.DOC_AI_PROCESSOR_ID || process.env.PROCESSOR_ID || '';
    if (!credsJson || !PROJECT_ID || !PROCESSOR_ID) {
      throw new Error('Missing Google Document AI env vars');
    }

    const credentials = JSON.parse(credsJson);
    const client = new documentai.DocumentProcessorServiceClient({ credentials });
    const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

    const requestDoc: any = {
      name,
      rawDocument: {
        content: fileBuf,
        mimeType: mime,
      },
    };

    const [result] = await client.processDocument(requestDoc as any);
    const doc: any = (result as any)?.document || (result as any);
    const parsedTextRaw: string = doc?.text || '';
    const parsedText = cleanText(parsedTextRaw);
    const pages: number = Array.isArray(doc?.pages) ? doc.pages.length : (doc?.pages?.length || 0);

    // Approximate confidence: average over entities if present; else null
    let confidence: number | null = null;
    try {
      const ent = Array.isArray(doc?.entities) ? doc.entities : [];
      const confs = ent.map((e: any) => Number(e?.confidence)).filter((n: any) => Number.isFinite(n));
      const avgConf = avg(confs);
      confidence = avgConf != null ? Number(avgConf.toFixed(3)) : null;
    } catch {}

    const tokens = wordCount(parsedText);

    // Persist
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
        console.log('CV_PARSE_OK', { studentId, size: fileBuf.byteLength, mime, pages, tokens });
      }
    } catch (dbErr: any) {
      await sql`UPDATE students SET cv_parse_status = 'error' WHERE id = ${studentId}`;
      const { host: dbHost, db: dbName } = getDbInfo()
      const res = NextResponse.json({ ok: false, code: 'DOC_AI_ERROR', message: dbErr?.message || 'DB error' }, { status: 502 })
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
    const res = NextResponse.json({ ok: false, code: 'DOC_AI_ERROR', message: error?.message || 'Document AI failed' }, { status: 502 })
    res.headers.set('X-DB-Host', dbHost)
    res.headers.set('X-DB-Name', dbName)
    res.headers.set('X-User-Email', emailLower)
    res.headers.set('X-Org-Slug', '')
    res.headers.set('X-Org-Id', '')
    res.headers.set('X-Loopback-Found', 'false')
    return res
  }
}
