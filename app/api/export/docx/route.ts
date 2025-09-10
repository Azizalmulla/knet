import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { CVData } from '@/lib/cv-schemas';

export async function POST(request: NextRequest) {
  try {
    const cvData: CVData = await request.json();

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Header
          new Paragraph({
            children: [
              new TextRun({
                text: cvData.fullName || '',
                bold: true,
                size: 32,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${cvData.email} | ${cvData.phone} | ${cvData.location}`,
                size: 20,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Summary
          ...(cvData.summary ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Professional Summary',
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: cvData.summary,
                  size: 20,
                }),
              ],
              spacing: { after: 300 },
            }),
          ] : []),

          // Experience
          ...(cvData.experience && cvData.experience.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Experience',
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            ...cvData.experience.flatMap(exp => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: exp.position,
                    bold: true,
                    size: 22,
                  }),
                  new TextRun({
                    text: ` - ${exp.company}`,
                    size: 22,
                  }),
                ],
                spacing: { before: 100, after: 50 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}`,
                    italics: true,
                    size: 18,
                  }),
                ],
                spacing: { after: 100 },
              }),
              ...(exp.bullets || []).map(bullet => 
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${bullet}`,
                      size: 20,
                    }),
                  ],
                  spacing: { after: 50 },
                })
              ),
            ]),
          ] : []),

          // Education
          ...(cvData.education && cvData.education.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Education',
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            ...cvData.education.flatMap(edu => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${edu.degree}${(edu as any).fieldOfStudy ? ` in ${(edu as any).fieldOfStudy}` : ''}`,
                    bold: true,
                    size: 22,
                  }),
                ],
                spacing: { before: 100, after: 50 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: edu.institution,
                    size: 20,
                  }),
                ],
                spacing: { after: 50 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${(edu as any).startDate || (edu as any).graduationDate || ''} - ${edu.endDate || 'Present'}`,
                    italics: true,
                    size: 18,
                  }),
                ],
                spacing: { after: edu.gpa ? 50 : 100 },
              }),
              ...(edu.gpa ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `GPA: ${edu.gpa}`,
                      size: 18,
                    }),
                  ],
                  spacing: { after: 100 },
                }),
              ] : []),
            ]),
          ] : []),

          // Projects
          ...(cvData.projects && cvData.projects.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Projects',
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            ...cvData.projects.flatMap(project => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: project.name,
                    bold: true,
                    size: 22,
                  }),
                ],
                spacing: { before: 100, after: 50 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: project.description,
                    size: 20,
                  }),
                ],
                spacing: { after: 50 },
              }),
              ...(project.technologies && project.technologies.length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Technologies: ${project.technologies.join(', ')}`,
                      size: 18,
                    }),
                  ],
                  spacing: { after: 50 },
                }),
              ] : []),
              ...(project.bullets || []).map(bullet => 
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${bullet}`,
                      size: 20,
                    }),
                  ],
                  spacing: { after: 50 },
                })
              ),
            ]),
          ] : []),

          // Skills
          ...(cvData.skills ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Skills',
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            }),
            ...(cvData.skills.technical && cvData.skills.technical.length > 0 ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Technical Skills: ',
                    bold: true,
                    size: 20,
                  }),
                  new TextRun({
                    text: cvData.skills.technical.join(', '),
                    size: 20,
                  }),
                ],
                spacing: { after: 100 },
              }),
            ] : []),
            ...(cvData.skills.languages && cvData.skills.languages.length > 0 ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Languages: ',
                    bold: true,
                    size: 20,
                  }),
                  new TextRun({
                    text: cvData.skills.languages.join(', '),
                    size: 20,
                  }),
                ],
                spacing: { after: 100 },
              }),
            ] : []),
            ...(cvData.skills.soft && cvData.skills.soft.length > 0 ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Soft Skills: ',
                    bold: true,
                    size: 20,
                  }),
                  new TextRun({
                    text: cvData.skills.soft.join(', '),
                    size: 20,
                  }),
                ],
                spacing: { after: 100 },
              }),
            ] : []),
          ] : []),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const bytes = new Uint8Array(buffer);
    
    return new NextResponse(bytes as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${cvData.fullName?.replace(/\s+/g, '_')}_CV.docx"`,
      },
    });
  } catch (error) {
    console.error('DOCX export error:', error);
    return NextResponse.json(
      { error: 'Failed to export DOCX' },
      { status: 500 }
    );
  }
}
