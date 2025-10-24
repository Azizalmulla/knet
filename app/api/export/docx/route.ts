import { NextRequest, NextResponse } from 'next/server';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { CVData } from '@/lib/cv-schemas';

export async function POST(request: NextRequest) {
  try {
    const body: any = await request.json();
    const cvData: CVData = body;
    const density: 'comfortable' | 'compact' = body?.density === 'compact' ? 'compact' : 'comfortable';

    const H2_BEFORE = density === 'compact' ? 160 : 200;
    const H2_AFTER  = density === 'compact' ? 80  : 100;
    const ITEM_BEFORE = density === 'compact' ? 80 : 100;
    const ITEM_AFTER  = density === 'compact' ? 40 : 50;
    const BULLET_AFTER = density === 'compact' ? 40 : 50;
    const HEADER1_AFTER = density === 'compact' ? 160 : 200; // name block
    const HEADER2_AFTER = density === 'compact' ? 320 : 400; // contact block

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
            spacing: { after: HEADER1_AFTER },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${cvData.email} | ${cvData.phone} | ${cvData.location}`,
                size: 20,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: HEADER2_AFTER },
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
              spacing: { before: H2_BEFORE, after: H2_AFTER },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: cvData.summary,
                  size: 20,
                }),
              ],
              spacing: { after: density === 'compact' ? 240 : 300 },
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
              spacing: { before: H2_BEFORE, after: H2_AFTER },
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
                spacing: { before: ITEM_BEFORE, after: ITEM_AFTER },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${exp.startDate} - ${exp.current ? 'Present' : exp.endDate}`,
                    italics: true,
                    size: 18,
                  }),
                ],
                spacing: { after: H2_AFTER },
              }),
              ...(exp.bullets || []).map((bullet: string) => 
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${bullet}`,
                      size: 20,
                    }),
                  ],
                  spacing: { after: BULLET_AFTER },
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
              spacing: { before: H2_BEFORE, after: H2_AFTER },
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
                spacing: { before: ITEM_BEFORE, after: ITEM_AFTER },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: edu.institution,
                    size: 20,
                  }),
                ],
                spacing: { after: ITEM_AFTER },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${(edu as any).startDate || (edu as any).graduationDate || ''} - ${edu.endDate || ((edu as any).currentlyStudying ? 'Present' : '')}`,
                    italics: true,
                    size: 18,
                  }),
                ],
                spacing: { after: edu.gpa ? ITEM_AFTER : H2_AFTER },
              }),
              ...(edu.gpa ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `GPA: ${edu.gpa}`,
                      size: 18,
                    }),
                  ],
                  spacing: { after: H2_AFTER },
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
              spacing: { before: H2_BEFORE, after: H2_AFTER },
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
                spacing: { before: ITEM_BEFORE, after: ITEM_AFTER },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: project.description,
                    size: 20,
                  }),
                ],
                spacing: { after: ITEM_AFTER },
              }),
              ...(project.technologies && project.technologies.length > 0 ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Technologies: ${project.technologies.join(', ')}`,
                      size: 18,
                    }),
                  ],
                  spacing: { after: ITEM_AFTER },
                }),
              ] : []),
              ...(project.bullets || []).map((bullet: string) => 
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${bullet}`,
                      size: 20,
                    }),
                  ],
                  spacing: { after: BULLET_AFTER },
                })
              ),
            ]),
          ] : []),

          // Achievements
          ...(() => {
            const list: string[] = Array.isArray((cvData as any)?.review?.achievements)
              ? (cvData as any).review.achievements
              : (Array.isArray((cvData as any)?.achievements) ? (cvData as any).achievements : []);
            const items = (list || []).filter(Boolean).slice(0, 8);
            if (items.length === 0) return [] as any[];
            return [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Achievements', bold: true, size: 24 }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: H2_BEFORE, after: H2_AFTER },
              }),
              ...items.map((a: string) => new Paragraph({
                children: [ new TextRun({ text: `• ${a}`, size: 20 }) ],
                spacing: { after: BULLET_AFTER },
              })),
            ]
          })(),

          // Certifications
          ...(() => {
            const list: string[] = Array.isArray((cvData as any)?.review?.certifications)
              ? (cvData as any).review.certifications
              : (Array.isArray((cvData as any)?.certifications) ? (cvData as any).certifications : []);
            const items = (list || []).filter(Boolean).slice(0, 6);
            if (items.length === 0) return [] as any[];
            return [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Certifications', bold: true, size: 24 }),
                ],
                heading: HeadingLevel.HEADING_2,
                spacing: { before: H2_BEFORE, after: H2_AFTER },
              }),
              ...items.map((c: string) => new Paragraph({
                children: [ new TextRun({ text: `• ${c}`, size: 20 }) ],
                spacing: { after: BULLET_AFTER },
              })),
            ]
          })(),

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
              spacing: { before: H2_BEFORE, after: H2_AFTER },
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
                spacing: { after: H2_AFTER },
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
                spacing: { after: H2_AFTER },
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
                spacing: { after: H2_AFTER },
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
