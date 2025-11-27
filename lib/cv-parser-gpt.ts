/**
 * Intelligent CV Parser using GPT-4o Vision
 * Extracts structured data from CVs (PDF, DOCX, images)
 */

import OpenAI from 'openai';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

// CV Structure matching our database schema
export interface ParsedCV {
  // Personal Info
  fullName: string;
  email: string;
  phone: string;
  location?: string;
  linkedIn?: string;
  portfolio?: string;

  // Professional Summary
  summary?: string;

  // Education
  education: Array<{
    institution: string;
    degree: string;
    field: string;
    startDate?: string;
    endDate?: string;
    gpa?: number;
    achievements?: string[];
  }>;

  // Experience
  experience: Array<{
    company: string;
    title: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    current?: boolean;
    description?: string;
    achievements?: string[];
  }>;

  // Skills
  skills: {
    technical: string[];
    soft: string[];
    languages?: string[];
    certifications?: string[];
  };

  // Projects
  projects?: Array<{
    name: string;
    description?: string;
    technologies?: string[];
    url?: string;
  }>;

  // Raw text for search/embedding
  rawText: string;

  // Metadata
  confidence: number;
  parseMethod: 'gpt-vision' | 'gpt-text' | 'pdf-parse' | 'mammoth';
  pageCount?: number;
  wordCount: number;
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const CV_EXTRACTION_PROMPT = `You are an expert CV/Resume parser. Extract ALL information from this CV into a structured JSON format.

Return ONLY valid JSON with this exact structure:
{
  "fullName": "string",
  "email": "string", 
  "phone": "string",
  "location": "string or null",
  "linkedIn": "string or null",
  "portfolio": "string or null",
  "summary": "professional summary or null",
  "education": [
    {
      "institution": "string",
      "degree": "string (e.g., Bachelor's, Master's, PhD)",
      "field": "string (field of study)",
      "startDate": "YYYY or YYYY-MM",
      "endDate": "YYYY or YYYY-MM or 'Present'",
      "gpa": number or null,
      "achievements": ["string"] or null
    }
  ],
  "experience": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY or 'Present'",
      "current": boolean,
      "description": "string",
      "achievements": ["string"] or null
    }
  ],
  "skills": {
    "technical": ["programming languages", "frameworks", "tools"],
    "soft": ["communication", "leadership", etc],
    "languages": ["English", "Arabic", etc] or null,
    "certifications": ["cert names"] or null
  },
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"],
      "url": "string or null"
    }
  ] or null
}

IMPORTANT:
- Extract real data only - don't invent information
- Use null for missing fields, not empty strings
- Parse dates in YYYY or YYYY-MM format
- Include ALL experience entries, even internships
- Technical skills should be specific (e.g., "Python", "React", not just "programming")
- Return ONLY the JSON, no explanation`;

/**
 * Main CV parsing function - uses GPT-4o Vision for intelligent extraction
 */
export async function parseCV(
  buffer: Buffer,
  contentType: string,
  options?: { extractTextOnly?: boolean }
): Promise<ParsedCV> {
  const openai = getOpenAI();
  const lowerMime = (contentType || '').toLowerCase();
  
  let rawText = '';
  let parseMethod: ParsedCV['parseMethod'] = 'gpt-vision';
  let pageCount: number | undefined;

  // Step 1: Extract raw text first (for searchability)
  if (lowerMime.includes('docx') || lowerMime.includes('officedocument.wordprocessingml')) {
    // DOCX - use Mammoth
    try {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || '';
      parseMethod = 'mammoth';
      console.log('[CV_PARSER] Extracted DOCX text:', rawText.length, 'chars');
    } catch (err) {
      console.error('[CV_PARSER] Mammoth failed:', err);
      throw new Error('Failed to parse DOCX file');
    }
  } else if (lowerMime.includes('pdf')) {
    // PDF - try text extraction first
    try {
      const pdfData = await pdfParse(buffer);
      rawText = pdfData.text || '';
      pageCount = pdfData.numpages;
      
      // If very little text, it's likely image-based
      if (rawText.length < 100) {
        console.log('[CV_PARSER] PDF appears image-based, will use Vision');
        rawText = ''; // Will extract via Vision
      } else {
        parseMethod = 'pdf-parse';
        console.log('[CV_PARSER] Extracted PDF text:', rawText.length, 'chars');
      }
    } catch (err) {
      console.log('[CV_PARSER] pdf-parse failed, will use Vision');
    }
  }

  // Step 2: Use GPT-4o Vision for intelligent extraction
  // Either for image-based PDFs or to enhance text-based extraction
  try {
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    // For text-based documents with good extraction, use text model
    if (rawText.length > 200 && (parseMethod === 'mammoth' || parseMethod === 'pdf-parse')) {
      console.log('[CV_PARSER] Using GPT-4o with extracted text');
      parseMethod = 'gpt-text';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: CV_EXTRACTION_PROMPT
          },
          {
            role: 'user',
            content: `Parse this CV text and extract structured information:\n\n${rawText.substring(0, 15000)}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 4000
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        ...parsed,
        rawText: rawText,
        confidence: 0.95,
        parseMethod,
        pageCount,
        wordCount: rawText.split(/\s+/).filter(Boolean).length
      };
    }

    // For PDFs with little/no extractable text (scanned documents)
    // Use OpenAI's native PDF support (announced March 2025)
    if (lowerMime.includes('pdf')) {
      console.log('[CV_PARSER] Using GPT-4o native PDF support for scanned document');
      parseMethod = 'gpt-vision';

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: CV_EXTRACTION_PROMPT
          },
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: 'cv.pdf',
                  file_data: `data:application/pdf;base64,${base64}`
                }
              } as any,
              {
                type: 'text',
                text: 'Extract all information from this CV/Resume PDF.'
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 4000
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      rawText = buildRawTextFromParsed(parsed);

      return {
        ...parsed,
        rawText,
        confidence: 0.92,
        parseMethod,
        pageCount,
        wordCount: rawText.split(/\s+/).filter(Boolean).length
      };
    }
    
    // For actual images (PNG, JPEG), use Vision with image_url
    console.log('[CV_PARSER] Using GPT-4o Vision for image document');
    parseMethod = 'gpt-vision';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: CV_EXTRACTION_PROMPT
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all information from this CV/Resume image.'
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'high'
              }
            }
          ]
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 4000
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    rawText = buildRawTextFromParsed(parsed);

    return {
      ...parsed,
      rawText,
      confidence: 0.92,
      parseMethod,
      pageCount,
      wordCount: rawText.split(/\s+/).filter(Boolean).length
    };

  } catch (err: any) {
    console.error('[CV_PARSER] GPT parsing failed:', err?.message);
    throw new Error(`CV parsing failed: ${err?.message}`);
  }
}

/**
 * Build searchable text from parsed structure
 */
function buildRawTextFromParsed(parsed: any): string {
  const parts: string[] = [];

  if (parsed.fullName) parts.push(parsed.fullName);
  if (parsed.email) parts.push(parsed.email);
  if (parsed.phone) parts.push(parsed.phone);
  if (parsed.summary) parts.push(parsed.summary);

  if (parsed.education) {
    for (const edu of parsed.education) {
      parts.push(`${edu.degree} ${edu.field} ${edu.institution}`);
    }
  }

  if (parsed.experience) {
    for (const exp of parsed.experience) {
      parts.push(`${exp.title} at ${exp.company}`);
      if (exp.description) parts.push(exp.description);
    }
  }

  if (parsed.skills) {
    if (parsed.skills.technical) parts.push(parsed.skills.technical.join(' '));
    if (parsed.skills.soft) parts.push(parsed.skills.soft.join(' '));
  }

  if (parsed.projects) {
    for (const proj of parsed.projects) {
      parts.push(proj.name);
      if (proj.description) parts.push(proj.description);
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Quick validation of parsed CV
 */
export function validateParsedCV(cv: ParsedCV): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!cv.fullName) issues.push('Missing full name');
  if (!cv.email) issues.push('Missing email');
  if (!cv.education?.length) issues.push('No education found');
  if (cv.wordCount < 50) issues.push('Very short CV');

  return {
    valid: issues.length === 0,
    issues
  };
}
