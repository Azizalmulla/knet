import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { CVData } from '@/lib/cv-schemas';

export async function POST(request: NextRequest) {
  try {
    const cvData: CVData = await request.json();

    // Generate HTML content for the CV
    const htmlContent = generateCVHTML(cvData);
    
    // Convert HTML to blob and upload
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
    const fileName = `${cvData.fullName?.replace(/\s+/g, '_')}_CV_${Date.now()}.html`;
    
    const blob = await put(fileName, htmlBlob, {
      access: 'public',
    });

    // Insert into database
    const result = await sql`
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
        ${cvData.education?.[0]?.field || 'Not specified'},
        ${cvData.skills?.technical?.[0] || 'Not specified'},
        'ai',
        ${blob.url}
      )
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      id: result.rows[0].id,
      cvUrl: blob.url 
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
              <h3>${edu.degree} in ${edu.field}</h3>
              <p>${edu.institution}</p>
              <p><em>${edu.startDate} - ${edu.endDate || 'Present'}</em></p>
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
