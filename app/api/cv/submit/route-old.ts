// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { generateCVHTML } from '@/lib/cv-html';
import { generateCVPDF } from '@/lib/cv-pdf';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit';
import crypto from 'crypto';

// Runtime configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Types for clarity
type Stage = 'init' | 'rate-limit' | 'validate' | 'db-check' | 'blob-upload' | 'db-insert' | 'done';

interface ErrorResponse {
  ok: false;
  ref: string;
  stage: Stage;
  code: string;
  message: string;
  detail?: string;
}

interface SuccessResponse {
  ok: true;
  ref: string;
  studentId: number;
  cvType: string;
  cvUrl: string | null;
  template: string | null;
}

// Handle OPTIONS requests
export async function OPTIONS(request: NextRequest) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Main POST handler
export async function POST(request: NextRequest) {
  const ref = crypto.randomUUID();
  let stage: Stage = 'init';

  console.log('[cv/submit]', { ref, stage, timestamp: new Date().toISOString() });

  let stage = 'init';
  
  try {
    console.log('[cv/submit]', { requestId, stage: 'start', timestamp: new Date().toISOString() });
    
    // ==================== STAGE 1: Rate Limiting ====================
    stage = 'rate-limit';
    const rateLimitResult = checkRateLimit(request);
    if (!rateLimitResult.success) {
      console.log('[cv/submit]', { requestId, stage: 'rate-limited' });
      return createRateLimitResponse(rateLimitResult);
    }


    // ==================== STAGE 2: Parse Payload ====================
    stage = 'parse-payload';
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr: any) {
      console.error('[cv/submit]', { requestId, stage: 'parse-failed', error: parseErr.message });
      return NextResponse.json(
        { 
          error: 'Invalid JSON payload',
          requestId,
          stage
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // ==================== STAGE 3: Validate Required Fields ====================
    stage = 'validate-fields';
    
    // Check cvType first - determines what other fields are required
    const cvType = body.cvType || 'ai';
    
    // Base required fields
    const baseRequired = ['fullName', 'email'];
    const missingBase = baseRequired.filter(field => !body[field]?.toString().trim());
    
    if (missingBase.length > 0) {
      console.log('[cv/submit]', { requestId, stage: 'validation-failed', missing: missingBase });
      return NextResponse.json(
        { 
          status: 'invalid',
          needs: missingBase,
          requestId 
        },
        { status: 422, headers: corsHeaders }
      );
    }
    
    // Check for placeholder values
    const placeholderChecks = [
      { field: 'fullName', placeholders: ['John Doe', 'Jane Doe', 'Test User', 'Your Name'] },
      { field: 'email', placeholders: ['john@mail.com', 'test@test.com', 'email@example.com', 'your@email.com'] },
      { field: 'phone', placeholders: ['+965', '12345678', '00000000'] },
      { field: 'location', placeholders: ['Kuwait City, Kuwait', 'City, Country', 'Your Location'] }
    ];
    
    const placeholderFields: string[] = [];
    for (const check of placeholderChecks) {
      const value = body[check.field]?.toString().trim();
      if (value && check.placeholders.some(p => value.toLowerCase() === p.toLowerCase())) {
        placeholderFields.push(check.field);
      }
    }
    
    if (placeholderFields.length > 0) {
      console.log('[cv/submit]', { requestId, stage: 'placeholder-validation-failed', fields: placeholderFields });
      return NextResponse.json(
        { 
          status: 'invalid',
          needs: placeholderFields,
          requestId 
        },
        { status: 422, headers: corsHeaders }
      );
    }
    
    // Validate field/area for AI CVs
    if (cvType === 'ai' && (!body.fieldOfStudy || !body.areaOfInterest)) {
      console.log('[cv/submit]', { requestId, stage: 'validation-failed', missing: ['fieldOfStudy', 'areaOfInterest'] });
      return NextResponse.json(
        { 
          status: 'invalid',
          needs: ['fieldOfStudy', 'areaOfInterest'],
          requestId 
        },
        { status: 422, headers: corsHeaders }
      );
    }
    
    // Validate cvUrl for uploaded CVs
    if (cvType === 'uploaded' && !body.cvUrl) {
      console.log('[cv/submit]', { requestId, stage: 'validation-failed', missing: ['cvUrl'] });
      return NextResponse.json(
        { 
          status: 'invalid',
          needs: ['cvUrl'],
          requestId 
        },
        { status: 422, headers: corsHeaders }
      );
    }

    // ==================== STAGE 4: Database Connectivity ====================
    stage = 'db-connectivity';
    try {
      const probeResult = await sql`SELECT 1 as probe`;
      console.log('[cv/submit]', { requestId, stage: 'db-connected' });
    } catch (dbErr: any) {
      console.error('[cv/submit]', { requestId, stage: 'db-probe-failed', error: dbErr.message });
      return NextResponse.json(
        {
          error: 'Database connection failed',
          requestId,
          stage,
          message: process.env.NODE_ENV === 'development' ? dbErr.message : 'Please try again later'
        },
        { status: 500, headers: corsHeaders }
      );
    }

    // ==================== STAGE 5: Generate/Process CV Content ====================
    let htmlUrl: string | null = null;
    let pdfUrl: string | null = null;
    let renderHash: string | null = null;
    
    if (cvType === 'ai') {
      stage = 'generate-html';
      try {
        // Generate HTML from CV data
        const template = body.template || 'minimal';
        const cvData = {
          fullName: body.fullName,
          email: body.email,
          phone: body.phone || '',
          location: body.location || '',
          summary: body.summary || '',
          education: body.education || [],
          experience: body.experience || [],
          projects: body.projects || [],
          skills: body.skills || {},
          template,
          language: body.language || 'en'
        };
        
        const htmlContent = generateCVHTML(cvData);
        renderHash = createHash('sha256').update(htmlContent).digest('hex');
        
        // Upload to Blob
        stage = 'blob-upload';
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const baseName = `${body.fullName?.replace(/\s+/g, '_') || 'cv'}_CV_${Date.now()}`;
        
        try {
          const htmlPut = await put(`cv-${baseName}.html`, htmlBlob, { access: 'public' });
          htmlUrl = htmlPut.url;
          pdfUrl = htmlUrl; // Use HTML for both until PDF generation is fixed
          console.log('[cv/submit]', { requestId, stage: 'blob-uploaded', url: htmlUrl });
        } catch (blobErr: any) {
          console.error('[cv/submit]', { requestId, stage: 'blob-failed', error: blobErr.message });
          
          // Check if it's a size limit error
          if (blobErr.message?.includes('413') || blobErr.message?.includes('too large')) {
            return NextResponse.json(
              { 
                error: 'File too large',
                requestId,
                stage
              },
              { status: 413, headers: corsHeaders }
            );
          }
          
          return NextResponse.json(
            { 
              error: 'Failed to upload CV',
              requestId,
              stage
            },
            { status: 422, headers: corsHeaders }
          );
        }
      } catch (genErr: any) {
        console.error('[cv/submit]', { requestId, stage: 'generate-failed', error: genErr.message });
        return NextResponse.json(
          { 
            error: 'Failed to generate CV',
            requestId,
            stage
          },
          { status: 422, headers: corsHeaders }
        );
      }
    } else {
      // Use uploaded CV URL
      htmlUrl = body.cvUrl;
      pdfUrl = body.cvUrl;
      renderHash = createHash('sha256').update(body.cvUrl).digest('hex');
    }

    // ==================== STAGE 6: Extract GPA (if applicable) ====================
    let gpa: number | null = null;
    if (body.gpa !== undefined && body.gpa !== null && body.gpa !== '') {
      const gpaNum = parseFloat(String(body.gpa));
      if (!isNaN(gpaNum) && gpaNum >= 0 && gpaNum <= 4) {
        gpa = gpaNum;
      }
    } else if (Array.isArray(body.education) && body.education.length > 0) {
      // Try to extract from education array
      const eduWithGpa = body.education.find((e: any) => e?.gpa);
      if (eduWithGpa?.gpa) {
        const gpaNum = parseFloat(String(eduWithGpa.gpa));
        if (!isNaN(gpaNum) && gpaNum >= 0 && gpaNum <= 4) {
          gpa = gpaNum;
        }
      }
    }

    // ==================== STAGE 7: Database Insert ====================
    stage = 'db-insert';
    const fieldOfStudy = body.fieldOfStudy || body.education?.[0]?.fieldOfStudy || 'Not specified';
    const areaOfInterest = body.areaOfInterest || body.skills?.technical?.[0] || 'Not specified';
    const suggestedVacancies = body.suggestedVacancies || null;
    
    let studentId: number | null = null;
    
    // Try multiple insert strategies (most compatible first)
    const insertAttempts = [
      // Attempt 1: Minimal columns only
      async () => {
        const result = await sql`
          INSERT INTO students (
            full_name, email, phone, field_of_study, area_of_interest, cv_type, cv_url, submitted_at
          ) VALUES (
            ${body.fullName}, ${body.email}, ${body.phone || null},
            ${fieldOfStudy}, ${areaOfInterest}, ${cvType}, ${htmlUrl}, NOW()
          )
          RETURNING id
        `;
        return result.rows[0].id;
      },
      // Attempt 2: Add template and render URLs (no suggested)
      async () => {
        const result = await sql`
          INSERT INTO students (
            full_name, email, phone, field_of_study, area_of_interest,
            cv_type, cv_template, cv_url, cv_url_html, cv_url_pdf, cv_render_hash,
            submitted_at
          ) VALUES (
            ${body.fullName}, ${body.email}, ${body.phone || null},
            ${fieldOfStudy}, ${areaOfInterest}, ${cvType},
            ${body.template || 'minimal'}, ${htmlUrl}, ${htmlUrl}, ${pdfUrl}, ${renderHash},
            NOW()
          )
          RETURNING id
        `;
        return result.rows[0].id;
      },
      // Attempt 3: Full schema including suggested vacancies
      async () => {
        const result = await sql`
          INSERT INTO students (
            full_name, email, phone, field_of_study, area_of_interest,
            cv_type, cv_template, cv_url, cv_url_html, cv_url_pdf, cv_render_hash,
            suggested_vacancies, submitted_at
          ) VALUES (
            ${body.fullName}, ${body.email}, ${body.phone || null},
            ${fieldOfStudy}, ${areaOfInterest}, ${cvType},
            ${body.template || 'minimal'}, ${htmlUrl}, ${htmlUrl}, ${pdfUrl}, ${renderHash},
            ${suggestedVacancies}, NOW()
          )
          RETURNING id
        `;
        return result.rows[0].id;
      }
    ];
    
    let attemptedSchemaFix = false;
    for (let i = 0; i < insertAttempts.length; i++) {
      try {
        studentId = await insertAttempts[i]();
        console.log('[cv/submit]', { requestId, stage: 'db-inserted', attempt: i + 1, studentId });
        break;
      } catch (dbErr: any) {
        console.error('[cv/submit]', { 
          requestId, 
          stage: `db-insert-attempt-${i + 1}-failed`, 
          error: dbErr.message 
        });
        // If table or columns are missing in prod, attempt a one-time minimal schema fix and retry
        const msg = String(dbErr?.message || '').toLowerCase();
        if (!attemptedSchemaFix && (msg.includes('relation') && msg.includes('students') && msg.includes('does not exist') || msg.includes('column') && msg.includes('does not exist'))) {
          attemptedSchemaFix = true;
          try {
            await sql`
              CREATE TABLE IF NOT EXISTS students (
                id SERIAL PRIMARY KEY,
                full_name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                field_of_study VARCHAR(255),
                area_of_interest VARCHAR(255),
                cv_type VARCHAR(50) DEFAULT 'uploaded',
                cv_url TEXT,
                suggested_vacancies TEXT,
                suggested_vacancies_list JSONB,
                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              )
            `;
            await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_template VARCHAR(32)`;
            await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_url_html TEXT`;
            await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_url_pdf TEXT`;
            await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_render_hash VARCHAR(128)`;
          } catch (fixErr: any) {
            console.error('[cv/submit]', { requestId, stage: 'schema-fix-failed', error: fixErr?.message || String(fixErr) });
          }
          // Retry current attempt index from the beginning (minimal first)
          i = -1;
          continue;
        }
        if (i === insertAttempts.length - 1) {
          // All attempts failed - do NOT report success; surface a clear 500 with requestId
          console.error('[cv/submit]', { requestId, stage: 'db-insert-all-failed' });
          return NextResponse.json(
            {
              error: 'Failed to persist submission',
              requestId,
              stage: 'db-insert-all-failed'
            },
            { status: 500, headers: corsHeaders }
          );
        }
      }
    }

    // ==================== STAGE 8: Optional KNET Submission ====================
    if (process.env.KNET_SUBMIT_URL && studentId) {
      stage = 'knet-submit';
      try {
        // Dynamic import to avoid build errors if module doesn't exist
        const knetModule = await import('@/lib/knet').catch(() => null);
        if (knetModule?.submitToKnet) {
          await knetModule.submitToKnet({
            studentId,
            template: body.template || 'minimal',
            cv_pdf_url: pdfUrl!,
            cv_html_url: htmlUrl!,
            render_hash: renderHash!,
          });
          console.log('[cv/submit]', { requestId, stage: 'knet-submitted' });
        }
      } catch (knetErr: any) {
        // KNET errors are non-fatal
        console.error('[cv/submit]', { requestId, stage: 'knet-failed', error: knetErr.message });
      }
    }

    // ==================== SUCCESS RESPONSE ====================
    console.log('[cv/submit]', { requestId, stage: 'success', studentId });
    
    return NextResponse.json(
      { 
        id: studentId || undefined,
        cvType: cvType,
        cvUrl: htmlUrl,
        requestId
      },
      { status: 200, headers: corsHeaders }
    );
    
  } catch (unexpectedErr: any) {
    // Catch-all for unexpected errors
    console.error('[cv/submit]', { 
      requestId, 
      stage, 
      error: unexpectedErr.message,
      stack: process.env.NODE_ENV === 'development' ? unexpectedErr.stack : undefined
    });
    
    return NextResponse.json(
      {
        error: 'An unexpected error occurred',
        requestId,
        stage,
        message: process.env.NODE_ENV === 'development' ? unexpectedErr.message : 'Please try again later'
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
