'use client';

import { CVData } from '@/lib/cv-schemas';
import { Inter, Noto_Kufi_Arabic } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], weight: ['400','600','700'] });
const noto = Noto_Kufi_Arabic({ subsets: ['arabic'], weight: ['400','700'] });

interface CreativeTemplateProps {
  data: CVData;
}

export function CreativeTemplate({ data }: CreativeTemplateProps) {
  const highlights = deriveHighlights(data);
  const isAR = (data as any)?.language === 'ar';
  const fontClass = isAR ? noto.className : inter.className;
  return (
    <div className={`cv-root max-w-4xl mx-auto bg-background text-foreground shadow-sm print:shadow-none ${fontClass}`} dir={isAR ? 'rtl' : 'ltr'}>
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[900px] rounded-lg overflow-hidden">
        {/* Sidebar */}
        <div className="md:col-span-4 text-white p-8" style={{ backgroundColor: '#0A5D86' }}>
          <div className="mb-8">
            <h1 className="text-[22px] md:text-[24px] font-bold tracking-[0.02em]">{data.fullName}</h1>
            {data.location && <p className="text-sm/6 opacity-90">{data.location}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {data.email && (
                <span className="inline-flex items-center rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs">{data.email}</span>
              )}
              {data.phone && (
                <span className="inline-flex items-center rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs">{data.phone}</span>
              )}
            </div>
          </div>

          {/* Skills */}
          {data.skills && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-wider mb-3 border-b border-white/30 pb-2">Skills</h2>
              {data.skills.technical && data.skills.technical.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1">
                    {data.skills.technical.map((skill: string, index: number) => (
                      <span key={index} className="inline-flex items-center gap-1 rounded-full bg-white text-[#0A5D86] px-2 py-0.5 text-[11px]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.skills.languages && data.skills.languages.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-semibold">Languages</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.skills.languages.map((skill: string, index: number) => (
                      <span key={index} className="inline-flex items-center gap-1 rounded-full bg-white text-[#0A5D86] px-2 py-0.5 text-[11px]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.skills.soft && data.skills.soft.length > 0 && (
                <div>
                  <h4 className="font-semibold">Soft Skills</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {data.skills.soft.map((skill: string, index: number) => (
                      <span key={index} className="inline-flex items-center gap-1 rounded-full bg-white text-[#0A5D86] px-2 py-0.5 text-[11px]">
                        <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Education quick summary */}
          {data.education && data.education.length > 0 && (
            <div>
              {data.education.map((edu, index) => (
                <div key={index} className="mb-4">
                  <h3 className="font-semibold text-sm">{edu.degree}</h3>
                  <p className="text-sm opacity-90">{(edu as any).fieldOfStudy || ''}</p>
                  <p className="text-xs opacity-75">{edu.institution}</p>
                  <p className="text-xs opacity-75">{((edu as any).startDate || (edu as any).graduationDate || '')} - {(edu as any).currentlyStudying ? 'Present' : edu.endDate || ''}</p>
                  {edu.gpa && <p className="text-xs opacity-75">GPA: {edu.gpa}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="md:col-span-8 p-8 bg-background">
          {/* Highlights */}
          {highlights.length > 0 && (
            <section className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {highlights.slice(0,3).map((h: string, i: number) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="text-sm text-foreground">{h}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Summary */}
          {data.summary && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                <h2 className="text-[12px] uppercase font-bold tracking-[0.05em]" style={{ color: '#0A5D86' }}>Professional Summary</h2>
              </div>
              <p className="text-[#374151] leading-relaxed text-[12px]">{data.summary}</p>
            </section>
          )}

          {/* Experience */}
          {data.experience && data.experience.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                <h2 className="text-[12px] uppercase font-bold tracking-[0.05em]" style={{ color: '#0A5D86' }}>Experience</h2>
              </div>
              {data.experience.map((exp, index) => (
                <div key={index} className="mb-6 relative ltr:pl-6 rtl:pr-6">
                  <div className="absolute ltr:left-0 rtl:right-0 top-2 w-3 h-3 rounded-full" style={{ backgroundImage: 'linear-gradient(135deg, #0F79AC 0%, #1288BF 100%)' }}></div>
                  <div className="absolute ltr:left-1.5 rtl:right-1.5 top-5 w-0.5 h-full bg-border"></div>

                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{exp.position}</h3>
                      <p className="text-muted-foreground font-medium">{exp.company}</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                      {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                    </span>
                  </div>

                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="text-[#374151] space-y-1 text-[12px]">
                      {exp.bullets.map((bullet: string, bulletIndex: number) => (
                        <li key={bulletIndex} className="flex items-start">
                          <span className="ltr:mr-2 rtl:ml-2 inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Projects */}
          {data.projects && data.projects.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                <h2 className="text-[12px] uppercase font-bold tracking-[0.05em]" style={{ color: '#0A5D86' }}>Projects</h2>
              </div>
              {data.projects.map((project, index) => (
                <div key={index} className="mb-6 p-4 ltr:border-l-4 rtl:border-r-4 border-primary bg-muted rounded-xl">
                  <h3 className="text-base font-semibold text-foreground mb-1">{project.name}</h3>
                  <p className="text-muted-foreground mb-3 text-sm">{project.description}</p>
                  
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="mb-2">
                      <h4 className="font-semibold">Technologies</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {project.technologies.map((tech: string, techIndex: number) => (
                          <span key={techIndex} className="bg-secondary text-secondary-foreground text-[11px] px-2 py-0.5 rounded-full">
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {project.bullets && project.bullets.length > 0 && (
                    <ul className="text-[#374151] space-y-1 text-[12px]">
                      {project.bullets.map((bullet: string, bulletIndex: number) => (
                        <li key={bulletIndex} className="flex items-start">
                          <span className="ltr:mr-2 rtl:ml-2 inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function deriveHighlights(d: CVData): string[] {
  const out: string[] = [];
  try {
    const exp = Array.isArray((d as any).experience) ? (d as any).experience : [];
    for (const e of exp) {
      if (Array.isArray(e?.bullets)) {
        for (const b of e.bullets) {
          if (out.length < 3) out.push(b);
        }
      }
      if (out.length >= 3) break;
    }
    if (out.length < 3 && Array.isArray((d as any).projects)) {
      for (const p of (d as any).projects) {
        if (Array.isArray(p?.bullets)) {
          for (const b of p.bullets) {
            if (out.length < 3) out.push(b);
          }
        }
        if (out.length >= 3) break;
      }
    }
  } catch {}
  return out.slice(0, 3);
}
