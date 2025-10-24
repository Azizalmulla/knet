import { head } from '@vercel/blob'

export interface ParsedResult {
  text: string
  wordCount: number
  pageCount?: number | null
  contentType: string
}

function htmlToText(html: string): string {
  try {
    // Remove scripts and styles
    const cleaned = html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/<head[\s\S]*?>[\s\S]*?<\/head>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return cleaned
  } catch {
    return html
  }
}

export async function fetchBlobBufferAndType(key: string, token: string): Promise<{ buffer: Buffer, contentType: string }>{
  const info: any = await head(key, { token })
  const url: string | undefined = info?.downloadUrl || info?.url
  if (!url) throw new Error('BLOB_NOT_FOUND')
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`BLOB_FETCH_FAILED_${res.status}`)
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const ab = await res.arrayBuffer()
  const buffer = Buffer.from(ab)
  return { buffer, contentType }
}

export async function parseBufferByType(buffer: Buffer, contentType: string): Promise<ParsedResult> {
  let text = ''
  let wordCount = 0
  let pageCount: number | null | undefined = null
  const ct = (contentType || '').toLowerCase()

  if (ct.includes('pdf')) {
    try {
      // Try pdf-parse first
      const pdfParse = (await import('pdf-parse')).default
      const out = await pdfParse(buffer)
      text = String(out.text || '').trim()
      pageCount = out.numpages || null
    } catch (pdfErr: any) {
      console.error('[PARSE] pdf-parse failed, using fallback:', pdfErr?.message)
      // Fallback to basic text extraction
      // Extract readable ASCII text from PDF buffer
      const raw = buffer.toString('latin1')
      const textMatches = raw.match(/\(([^)]+)\)/g) || []
      text = textMatches
        .map(m => m.slice(1, -1))
        .join(' ')
        .replace(/\\[rnt]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      
      if (!text || text.length < 10) {
        // If that fails, try UTF-8 with filtering
        text = buffer.toString('utf8')
          .replace(/[^\x20-\x7E\n]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
      pageCount = null
    }
  } else if (ct.includes('html')) {
    const html = buffer.toString('utf8')
    text = htmlToText(html)
  } else if (ct.includes('text/plain')) {
    text = buffer.toString('utf8')
  } else if (ct.includes('officedocument.wordprocessingml.document') || ct.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
    // DOCX
    const mammoth = (await import('mammoth')).default
    const out = await mammoth.extractRawText({ buffer })
    text = String(out.value || '').trim()
  } else {
    // Fallback: try PDF parser first, then treat as text
    try {
      const pdfParse = (await import('pdf-parse')).default
      const out = await pdfParse(buffer)
      text = String(out.text || '').trim()
      pageCount = out.numpages || null
    } catch {
      text = buffer.toString('utf8')
    }
  }

  wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0
  return { text, wordCount, pageCount, contentType: contentType || 'application/octet-stream' }
}
