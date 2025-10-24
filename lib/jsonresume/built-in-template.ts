// Built-in CV template that doesn't rely on external packages
// Professional, clean design that works in serverless environments

export function renderBuiltInTemplate(cv: any): string {
  const fullName = cv?.fullName || cv?.name || 'No Name'
  const email = cv?.email || ''
  const phone = cv?.phone || ''
  const location = cv?.location || ''
  const summary = cv?.summary || ''
  
  const education = cv?.education || []
  const experience = cv?.experience || []
  const projects = cv?.projects || []
  const skills = cv?.skills || []
  const languages = cv?.languages || []

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fullName} - CV</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 40px 60px;
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #000;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .contact-info {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }
    .contact-info span {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      text-transform: uppercase;
      border-bottom: 2px solid #000;
      padding-bottom: 5px;
      margin-bottom: 15px;
      letter-spacing: 0.5px;
    }
    .summary {
      font-size: 15px;
      line-height: 1.7;
      color: #444;
      text-align: justify;
    }
    .item {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 5px;
    }
    .item-title {
      font-size: 16px;
      font-weight: 600;
      color: #000;
    }
    .item-subtitle {
      font-size: 14px;
      color: #666;
      font-style: italic;
    }
    .item-date {
      font-size: 13px;
      color: #999;
      white-space: nowrap;
    }
    .item-description {
      font-size: 14px;
      color: #555;
      line-height: 1.6;
      margin-top: 5px;
    }
    .item-description ul {
      margin-left: 20px;
      margin-top: 5px;
    }
    .item-description li {
      margin-bottom: 3px;
    }
    .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    .skill-item {
      background: #f5f5f5;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
      border-left: 3px solid #000;
    }
    .languages-list {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }
    .language-item {
      background: #f5f5f5;
      padding: 8px 15px;
      border-radius: 20px;
      font-size: 13px;
    }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${fullName}</h1>
    <div class="contact-info">
      ${email ? `<span>📧 ${email}</span>` : ''}
      ${phone ? `<span>📱 ${phone}</span>` : ''}
      ${location ? `<span>📍 ${location}</span>` : ''}
    </div>
  </div>

  ${summary ? `
  <div class="section">
    <h2 class="section-title">Professional Summary</h2>
    <div class="summary">${summary}</div>
  </div>
  ` : ''}

  ${experience.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Experience</h2>
    ${experience.map((exp: any) => `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-title">${exp.position || exp.title || 'Position'}</div>
            <div class="item-subtitle">${exp.company || 'Company'}</div>
          </div>
          <div class="item-date">
            ${formatDate(exp.startDate)} - ${exp.current ? 'Present' : formatDate(exp.endDate)}
          </div>
        </div>
        ${exp.description ? `<div class="item-description">${formatDescription(exp.description)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${education.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Education</h2>
    ${education.map((edu: any) => `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-title">${edu.degree || 'Degree'} in ${edu.fieldOfStudy || 'Field of Study'}</div>
            <div class="item-subtitle">${edu.institution || edu.school || 'Institution'}</div>
          </div>
          <div class="item-date">
            ${formatDate(edu.startDate)} - ${edu.graduationDate ? formatDate(edu.graduationDate) : 'Present'}
          </div>
        </div>
        ${edu.gpa ? `<div class="item-description">GPA: ${edu.gpa}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${projects.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Projects</h2>
    ${projects.map((proj: any) => `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-title">${proj.name || proj.title || 'Project'}</div>
            ${proj.url ? `<div class="item-subtitle">${proj.url}</div>` : ''}
          </div>
          ${proj.date ? `<div class="item-date">${formatDate(proj.date)}</div>` : ''}
        </div>
        ${proj.description ? `<div class="item-description">${formatDescription(proj.description)}</div>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${skills.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Skills</h2>
    <div class="skills-grid">
      ${skills.map((skill: any) => {
        const skillName = typeof skill === 'string' ? skill : (skill.name || skill.skill || 'Skill')
        return `<div class="skill-item">${skillName}</div>`
      }).join('')}
    </div>
  </div>
  ` : ''}

  ${languages.length > 0 ? `
  <div class="section">
    <h2 class="section-title">Languages</h2>
    <div class="languages-list">
      ${languages.map((lang: any) => {
        const langName = typeof lang === 'string' ? lang : lang.language
        const level = typeof lang === 'object' ? lang.proficiency || lang.level : ''
        return `<div class="language-item">${langName}${level ? ` (${level})` : ''}</div>`
      }).join('')}
    </div>
  </div>
  ` : ''}
</body>
</html>`
}

function formatDate(date: string | undefined): string {
  if (!date) return ''
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return date
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  } catch {
    return date
  }
}

function formatDescription(desc: string): string {
  if (!desc) return ''
  // Convert newlines to <br> or handle bullet points
  const lines = desc.split('\n').filter(l => l.trim())
  if (lines.length > 1) {
    return '<ul>' + lines.map(line => `<li>${line.trim()}</li>`).join('') + '</ul>'
  }
  return desc
}
