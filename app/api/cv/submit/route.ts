import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { CVData } from '@/lib/cv-schemas';
import { findRowForAudit } from '@/lib/career-map';
import { KnetProfileSchema, normalizeArea, normalizeDegree, normalizeYoE } from '@/lib/watheefti-taxonomy';
import { checkRateLimit, createRateLimitResponse } from '@/lib/rateLimit';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // Check rate limit
  const rateLimitResult = checkRateLimit(request);
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  try {
    const cvData: CVData & { fieldOfStudy?: string; areaOfInterest?: string; suggestedVacancies?: string | null } = await request.json();

    // Basic validation: return 400 for invalid/missing required fields instead of 500
    if (!cvData?.fullName || !cvData?.email) {
      return NextResponse.json(
        { error: 'Invalid request: missing required fields' },
        { status: 400 }
      );
    }

    // Audit logging
    if (cvData.fieldOfStudy && cvData.areaOfInterest) {
      const auditRow = findRowForAudit(cvData.fieldOfStudy, cvData.areaOfInterest);
      const rawHash = cvData.suggestedVacancies ? crypto.createHash('sha256').update(cvData.suggestedVacancies).digest('hex') : null;
      console.log('AI_CV_SUBMIT_AUDIT:', {
        timestamp: new Date().toISOString(),
        field: cvData.fieldOfStudy,
        area: cvData.areaOfInterest,
        rawRow: auditRow,
        suggestedVacanciesHash: rawHash,
        userEmail: cvData.email
      });
    }

    // Generate HTML content for the CV using selected template
    const htmlContent = generateCVHTML(cvData);

    // Convert HTML to blob and upload (tolerate missing blob token)
    let blobUrl: string | null = null;
    try {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const fileName = `${cvData.fullName?.replace(/\s+/g, '_') || 'cv'}_CV_${Date.now()}.html`;
      try {
        const blob = await put(`ai-cvs/${fileName}`, htmlBlob, {
          access: 'public',
          contentType: 'text/html; charset=utf-8',
          addRandomSuffix: true,
          token: process.env.BLOB_READ_WRITE_TOKEN as string | undefined,
        });
        blobUrl = blob.url;
      } catch (inner) {
        console.error('Direct BLOB put failed, attempting internal upload API:', (inner as any)?.message || inner);
        // Fallback: POST to our own /api/blob/upload as multipart
        try {
          const fd = new FormData();
          const nodeBlob = new Blob([htmlContent], { type: 'text/html' });
          fd.append('file', nodeBlob, fileName);
          const uploadUrl = new URL('/api/blob/upload', request.url).toString();
          const resp = await fetch(uploadUrl, { method: 'POST', body: fd });
          const j = await resp.json().catch(() => ({} as any));
          if (resp.ok && j?.ok && j?.url) {
            blobUrl = j.url as string;
          } else {
            console.error('Internal upload API failed:', j);
          }
        } catch (fallbackErr) {
          console.error('Internal upload API error:', (fallbackErr as any)?.message || fallbackErr);
        }
      }
    } catch (e) {
      console.error('BLOB upload failed (continuing without cv_url):', (e as any)?.message || e);
    }

    // If blob upload failed entirely, stop here with a clear error
    if (!blobUrl) {
      return NextResponse.json(
        { ok: false, stage: 'blob-upload', message: 'Failed to upload CV to storage' },
        { status: 500 }
      );
    }

    // Ensure columns exist (idempotent) for legacy students table
    try { await sql`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cv_json JSONB`; } catch {}
    try { await sql`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cv_template TEXT`; } catch {}
    try { await sql`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS knet_profile JSONB`; } catch {}
    try { await sql`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS suggested_vacancies TEXT`; } catch {}
    try { await sql`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS suggested_vacancies_list TEXT[]`; } catch {}

    // Insert into database (persist both html URL and JSON for SSR templates)
    const fieldOfStudy = cvData.fieldOfStudy || (cvData as any)?.education?.[0]?.fieldOfStudy || 'Not specified';
    const areaOfInterest = cvData.areaOfInterest || ((cvData as any)?.skills?.technical?.[0]) || 'Not specified';

    // Build normalized knet_profile and attach into cv_json as knetProfile
    const rawKP = (cvData as any)?.knetProfile as any
    if (!rawKP || typeof rawKP !== 'object' || !rawKP.degreeBucket || !rawKP.yearsOfExperienceBucket || !rawKP.areaOfInterest) {
      return NextResponse.json(
        { error: 'knetProfile (degreeBucket, yearsOfExperienceBucket, areaOfInterest) is required' },
        { status: 400 }
      )
    }
    let knetProfile: any
    if (rawKP && typeof rawKP === 'object') {
      // Normalize client-provided selections to canonical buckets
      const normalizedFromRaw = {
        degreeBucket: normalizeDegree(rawKP.degreeBucket),
        yearsOfExperienceBucket: normalizeYoE(rawKP.yearsOfExperienceBucket),
        areaOfInterest: normalizeArea(rawKP.areaOfInterest),
      }
      knetProfile = normalizedFromRaw
      // Compare and log diffs when normalization altered values
      try {
        const diffs: string[] = []
        if (rawKP.degreeBucket && rawKP.degreeBucket !== normalizedFromRaw.degreeBucket) diffs.push('degreeBucket')
        if (rawKP.yearsOfExperienceBucket && rawKP.yearsOfExperienceBucket !== normalizedFromRaw.yearsOfExperienceBucket) diffs.push('yearsOfExperienceBucket')
        if (rawKP.areaOfInterest && rawKP.areaOfInterest !== normalizedFromRaw.areaOfInterest) diffs.push('areaOfInterest')
        if (diffs.length) {
          console.log('knet_profile_normalized_diff', {
            source: 'ai_builder',
            email: cvData.email,
            fields: diffs,
            before: rawKP,
            after: normalizedFromRaw,
            timestamp: new Date().toISOString(),
          })
        }
      } catch {}
    } else {
      knetProfile = {
        degreeBucket: normalizeDegree(fieldOfStudy),
        yearsOfExperienceBucket: normalizeYoE(undefined),
        areaOfInterest: normalizeArea(areaOfInterest),
      }
    }
    ;(cvData as any).knetProfile = knetProfile
    const suggested = cvData.suggestedVacancies || null;
    // Prepare list as Postgres array literal (for text[] columns). Example: {"A","B"}
    const suggestedList = suggested ? suggested.split('/').map(s => s.trim()).filter(Boolean) : null;
    const suggestedArrayLiteral = suggestedList && suggestedList.length
      ? `{${suggestedList.map(v => '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"').join(',')}}`
      : null;

    let result;
    const templateChoice = ((cvData as any).template || 'minimal') as string;
    try {
      result = await sql`
        INSERT INTO public.students (
          full_name, 
          email, 
          phone, 
          field_of_study, 
          area_of_interest, 
          cv_type, 
          cv_url,
          suggested_vacancies,
          suggested_vacancies_list,
          cv_json,
          cv_template,
          knet_profile
        ) VALUES (
          ${cvData.fullName},
          ${cvData.email},
          ${cvData.phone},
          ${fieldOfStudy},
          ${areaOfInterest},
          'ai',
          ${blobUrl},
          ${suggested},
          ${suggestedArrayLiteral},
          ${JSON.stringify(cvData)},
          ${templateChoice},
          ${JSON.stringify(knetProfile)}
        )
        ON CONFLICT (email) DO UPDATE SET
          phone = EXCLUDED.phone,
          field_of_study = EXCLUDED.field_of_study,
          area_of_interest = EXCLUDED.area_of_interest,
          cv_type = EXCLUDED.cv_type,
          cv_url = COALESCE(EXCLUDED.cv_url, students.cv_url),
          cv_json = EXCLUDED.cv_json,
          cv_template = EXCLUDED.cv_template,
          submitted_at = NOW(),
          suggested_vacancies = EXCLUDED.suggested_vacancies,
          suggested_vacancies_list = COALESCE(EXCLUDED.suggested_vacancies_list, students.suggested_vacancies_list),
          knet_profile = EXCLUDED.knet_profile
        RETURNING id
      `;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('Primary insert failed, retrying with minimal columns:', msg);
      // Fallback for older schemas without suggested_vacancies columns
      try {
        result = await sql`
          INSERT INTO public.students (
            full_name, 
            email, 
            phone, 
            field_of_study, 
            area_of_interest, 
            cv_type, 
            cv_url
          ) VALUES (
            ${cvData.fullName},
            ${cvData.email},
            ${cvData.phone},
            ${fieldOfStudy},
            ${areaOfInterest},
            'ai',
            ${blobUrl}
          )
          ON CONFLICT (email) DO UPDATE SET
            phone = EXCLUDED.phone,
            field_of_study = EXCLUDED.field_of_study,
            area_of_interest = EXCLUDED.area_of_interest,
            cv_type = EXCLUDED.cv_type,
            cv_url = COALESCE(EXCLUDED.cv_url, students.cv_url),
            submitted_at = NOW()
          RETURNING id
        `;
      } catch (fallbackErr: any) {
        return NextResponse.json(
          { ok: false, stage: 'db-insert', message: fallbackErr?.message || String(fallbackErr) },
          { status: 500 }
        );
      }
    }

    // Mark parse done for AI HTML/JSON path (no external parsing needed)
    try { await sql`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cv_parse_status TEXT DEFAULT 'queued'`; } catch {}
    try { await sql`UPDATE public.students SET cv_parse_status = 'done' WHERE id = ${result.rows[0].id}`; } catch {}

    return NextResponse.json({ 
      ok: true, 
      studentId: result.rows[0].id,
      cvUrl: blobUrl 
    });
  } catch (error) {
    console.error('CV submission error:', error);
    return NextResponse.json(
      { ok: false, stage: 'unexpected', message: (error as any)?.message || String(error) },
      { status: 500 }
    );
  }
}

function generateCVHTML(data: CVData & { template?: string }): string {
  const template: string = data.template || 'minimal';
  const language = data.language || 'en';
  const isRTL = language === 'ar';
  
  // Template-specific styles
  const getTemplateStyles = () => {
    const baseStyles = `
      body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
      .cv-container { max-width: 800px; margin: 0 auto; }
      .header { padding-bottom: 20px; margin-bottom: 20px; }
      .section { margin-bottom: 30px; }
      .experience-item, .education-item, .project-item { margin-bottom: 20px; }
      .skills { display: flex; flex-wrap: wrap; gap: 10px; }
      .skill-tag { padding: 5px 10px; border-radius: 15px; font-size: 14px; }
      ul { padding-${isRTL ? 'right' : 'left'}: 20px; }
      @media print { body { margin: 0; padding: 10px; } }
    `;

    if (template === 'creative') {
      return baseStyles + `
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .cv-container { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 30px; }
        .header { text-align: center; border-bottom: 2px solid rgba(255,255,255,0.3); }
        .header h1 { font-size: 2.5em; margin: 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .section h2 { color: #fff; border-bottom: 2px solid rgba(255,255,255,0.3); padding-bottom: 10px; font-size: 1.5em; }
        .skill-tag { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); }
        .experience-item h3, .education-item h3, .project-item h3 { color: #f0f8ff; }
      `;
    } else if (template === 'modern') {
      return baseStyles + `
        body { background: #f8fafc; color: #1e293b; }
        .cv-container { background: white; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-radius: 12px; padding: 40px; }
        .header { text-align: center; border-bottom: 3px solid #3b82f6; }
        .header h1 { font-size: 2.2em; margin: 0; color: #1e40af; font-weight: 700; }
        .section h2 { color: #1e40af; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; font-weight: 600; }
        .skill-tag { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .experience-item h3, .education-item h3, .project-item h3 { color: #374151; font-weight: 600; }
      `;
    } else {
      // minimal template
      return baseStyles + `
        body { background: white; color: #333; }
        .header { text-align: center; border-bottom: 2px solid #333; }
        .header h1 { font-size: 2em; margin: 0; }
        .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .skill-tag { background: #f0f0f0; color: #333; }
      `;
    }
  };

  return `
    <!DOCTYPE html>
    <html lang="${language}" ${isRTL ? 'dir="rtl"' : ''}>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.fullName} - CV</title>
      <style>${getTemplateStyles()}</style>
    </head>
    <body>
      <div class="cv-container">
        <div class="header">
          <h1>${data.fullName}</h1>
          <p>${data.email} | ${data.phone} | ${data.location}</p>
        </div>
        
        ${data.summary ? `
        <div class="section">
          <h2>Professional Summary</h2>
          <p>${data.summary}</p>
        </div>
        ` : ''}
        
        ${data.experience && data.experience.length > 0 ? `
        <div class="section">
          <h2>Experience</h2>
          ${data.experience.map((exp: any) => `
            <div class="experience-item">
              <h3>${exp.position} - ${exp.company}</h3>
              <p><em>${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}</em></p>
              ${exp.bullets && exp.bullets.length > 0 ? `
                <ul>
                  ${exp.bullets.map((bullet: string) => `<li>${bullet}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${data.education && data.education.length > 0 ? `
        <div class="section">
          <h2>Education</h2>
          ${data.education.map((edu: any) => `
            <div class="education-item">
              <h3>${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}</h3>
              <p>${edu.institution}</p>
              <p><em>${edu.startDate || ''} - ${edu.endDate || edu.graduationDate || 'Present'}</em></p>
              ${edu.gpa ? `<p>GPA: ${edu.gpa}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${data.projects && data.projects.length > 0 ? `
        <div class="section">
          <h2>Projects</h2>
          ${data.projects.map((project: any) => `
            <div class="project-item">
              <h3>${project.name}</h3>
              <p>${project.description}</p>
              ${project.technologies && project.technologies.length > 0 ? `
                <p><strong>Technologies:</strong> ${project.technologies.join(', ')}</p>
              ` : ''}
              ${project.bullets && project.bullets.length > 0 ? `
                <ul>
                  ${project.bullets.map((bullet: string) => `<li>${bullet}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${data.skills ? `
        <div class="section">
          <h2>Skills</h2>
          ${data.skills.technical && data.skills.technical.length > 0 ? `
            <h4>Technical Skills</h4>
            <div class="skills">
              ${data.skills.technical.map((skill: string) => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
          ` : ''}
          ${data.skills.languages && data.skills.languages.length > 0 ? `
            <h4>Languages</h4>
            <div class="skills">
              ${data.skills.languages.map((skill: string) => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
          ` : ''}
          ${data.skills.soft && data.skills.soft.length > 0 ? `
            <h4>Soft Skills</h4>
            <div class="skills">
              ${data.skills.soft.map((skill: string) => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}
