import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { CVData } from '@/lib/cv-schemas';
import { findRowForAudit } from '@/lib/career-map';
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

    // Generate HTML content for the CV
    const htmlContent = generateCVHTML(cvData);

    // Convert HTML to blob and upload (tolerate missing blob token)
    let blobUrl: string | null = null;
    try {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const fileName = `${cvData.fullName?.replace(/\s+/g, '_') || 'cv'}_CV_${Date.now()}.html`;
      const blob = await put(fileName, htmlBlob, { access: 'public' });
      blobUrl = blob.url;
    } catch (e) {
      console.error('BLOB upload failed (continuing without cv_url):', (e as any)?.message || e);
    }

    // Insert into database
    const fieldOfStudy = cvData.fieldOfStudy || (cvData as any)?.education?.[0]?.fieldOfStudy || 'Not specified';
    const areaOfInterest = cvData.areaOfInterest || ((cvData as any)?.skills?.technical?.[0]) || 'Not specified';
    const suggested = cvData.suggestedVacancies || null;
    const suggestedList = suggested ? JSON.stringify(suggested.split('/').map(s => s.trim()).filter(Boolean)) : null;

    let result;
    try {
      result = await sql`
        INSERT INTO students (
          full_name, 
          email, 
          phone, 
          field_of_study, 
          area_of_interest, 
          cv_type, 
          cv_url,
          suggested_vacancies,
          suggested_vacancies_list
        ) VALUES (
          ${cvData.fullName},
          ${cvData.email},
          ${cvData.phone},
          ${fieldOfStudy},
          ${areaOfInterest},
          'ai',
          ${blobUrl},
          ${suggested},
          ${suggestedList}
        )
        RETURNING id
      `;
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('Primary insert failed, retrying with minimal columns:', msg);
      // Fallback for older schemas without suggested_vacancies columns
      result = await sql`
        INSERT INTO students (
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
        RETURNING id
      `;
    }

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id,
      cvUrl: blobUrl 
    });
  } catch (error) {
    console.error('CV submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit CV' },
      { status: 500 }
    );
  }
}

function generateCVHTML(data: CVData): string {
  return `
    <!DOCTYPE html>
    <html lang="${data.language || 'en'}" ${data.language === 'ar' ? 'dir="rtl"' : ''}>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.fullName} - CV</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .cv-container { max-width: 800px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .experience-item, .education-item, .project-item { margin-bottom: 20px; }
        .skills { display: flex; flex-wrap: wrap; gap: 10px; }
        .skill-tag { background: #f0f0f0; padding: 5px 10px; border-radius: 15px; font-size: 14px; }
        @media print { body { margin: 0; } }
      </style>
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
          ${data.experience.map(exp => `
            <div class="experience-item">
              <h3>${exp.position} - ${exp.company}</h3>
              <p><em>${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}</em></p>
              ${exp.bullets && exp.bullets.length > 0 ? `
                <ul>
                  ${exp.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${data.education && data.education.length > 0 ? `
        <div class="section">
          <h2>Education</h2>
          ${data.education.map(edu => `
            <div class="education-item">
              <h3>${edu.degree}${(edu as any).fieldOfStudy ? ` in ${(edu as any).fieldOfStudy}` : ''}</h3>
              <p>${edu.institution}</p>
              <p><em>${(edu as any).startDate || ''} - ${edu.endDate || (edu as any).graduationDate || 'Present'}</em></p>
              ${edu.gpa ? `<p>GPA: ${edu.gpa}</p>` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}
        
        ${data.projects && data.projects.length > 0 ? `
        <div class="section">
          <h2>Projects</h2>
          ${data.projects.map(project => `
            <div class="project-item">
              <h3>${project.name}</h3>
              <p>${project.description}</p>
              ${project.technologies && project.technologies.length > 0 ? `
                <p><strong>Technologies:</strong> ${project.technologies.join(', ')}</p>
              ` : ''}
              ${project.bullets && project.bullets.length > 0 ? `
                <ul>
                  ${project.bullets.map(bullet => `<li>${bullet}</li>`).join('')}
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
              ${data.skills.technical.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
          ` : ''}
          ${data.skills.languages && data.skills.languages.length > 0 ? `
            <h4>Languages</h4>
            <div class="skills">
              ${data.skills.languages.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
          ` : ''}
          ${data.skills.soft && data.skills.soft.length > 0 ? `
            <h4>Soft Skills</h4>
            <div class="skills">
              ${data.skills.soft.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
}
