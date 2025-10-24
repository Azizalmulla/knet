'use client';

import { CVData } from '@/lib/cv-schemas';
import { Inter, Noto_Kufi_Arabic } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], weight: ['400','600','700'] });
const noto = Noto_Kufi_Arabic({ subsets: ['arabic'], weight: ['400','700'] });

interface MinimalTemplateProps {
  data: CVData;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#FFE200' }} />
      <div className="text-[12px] uppercase font-bold tracking-[0.05em]" style={{ color: '#0A5D86' }}>{children}</div>
    </div>
  );
}

function SectionRule() {
  return <div className="h-px bg-[#E6EEF5] mt-4" />;
}

export function MinimalTemplate({ data }: MinimalTemplateProps) {
  const highlights = deriveHighlights(data);
  const isAR = (data as any)?.language === 'ar';
  const fontClass = isAR ? noto.className : inter.className;
  return (
    <div className={`cv-root max-w-4xl mx-auto bg-background text-foreground p-10 shadow-sm print:shadow-none ${fontClass}`} dir={isAR ? 'rtl' : 'ltr'}>
      {/* Identity Header */}
      <header className="pb-6 mb-6">
        <div className="text-center">
          <h1 className="text-[22px] md:text-[24px] font-bold tracking-[0.06em] uppercase">{data.fullName}</h1>
          <div className="mt-2 text-[13px] text-[#6b7280] flex flex-wrap items-center justify-center gap-2">
            {data.email && <span>{data.email}</span>}
            {data.email && data.phone && <span className="mx-1">•</span>}
            {data.phone && <span>{data.phone}</span>}
            {(data.email || data.phone) && data.location && <span className="mx-1">•</span>}
            {data.location && <span>{data.location}</span>}
          </div>
        </div>
        <div className="h-px bg-[#E6EEF5] mt-5" />
      </header>

      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Highlights</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {highlights.slice(0,3).map((h, i) => (
              <div key={i} className="rounded-xl border border-[#E6EEF5] bg-card p-3 text-sm text-foreground">
                {h}
              </div>
            ))}
          </div>
          <SectionRule />
        </section>
      )}

      {/* Summary */}
      {data.summary && (
        <section className="mb-6">
          <SectionTitle>Professional Summary</SectionTitle>
          <p className="text-[11.5px] leading-[1.4] text-[#374151]">{data.summary}</p>
          <SectionRule />
        </section>
      )}

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Experience</SectionTitle>
          {data.experience.map((exp, index) => (
            <div key={index} className="mb-4">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-[13px] text-foreground tracking-tight">{exp.position}</h3>
                <span className="text-[11px] text-[#6b7280] rounded-full bg-[#F7FAFC] px-2 py-0.5">
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p className="text-[#6b7280] mb-2 text-[12px]">{exp.company}</p>
              {exp.bullets && exp.bullets.length > 0 && (
                <ul className="list-disc list-inside text-[11.5px] text-[#374151] space-y-1.5">
                  {exp.bullets.map((bullet: string, bulletIndex: number) => (
                    <li key={bulletIndex}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <SectionRule />
        </section>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Education</SectionTitle>
          {data.education.map((edu, index) => (
            <div key={index} className="mb-3">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-semibold text-[13px] text-foreground tracking-tight">{edu.degree}{(edu as any).fieldOfStudy ? ` in ${(edu as any).fieldOfStudy}` : ''}</h3>
                <span className="text-[11px] text-[#6b7280] rounded-full bg-[#F7FAFC] px-2 py-0.5">
                  {(((edu as any).startDate) || (edu as any).graduationDate || '')} - {edu.endDate || ((edu as any).currentlyStudying ? 'Present' : '')}
                </span>
              </div>
              <p className="text-[#6b7280] text-[12px]">{edu.institution}</p>
              {edu.gpa && <p className="text-[11.5px] text-[#6b7280]">GPA: {edu.gpa}</p>}
            </div>
          ))}
          <SectionRule />
        </section>
      )}

      {/* Projects */}
      {data.projects && data.projects.length > 0 && (
        <section className="mb-6">
          <SectionTitle>Projects</SectionTitle>
          {data.projects.map((project, index) => (
            <div key={index} className="mb-4">
              <h3 className="font-semibold text-[13px] text-foreground mb-1 tracking-tight">{project.name}</h3>
              <p className="text-[12px] text-[#6b7280] mb-2">{project.description}</p>
              {project.technologies && project.technologies.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {project.technologies.map((tech: string, i: number) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-[#F7FAFC] px-2 py-0.5 text-[11px] text-[#6b7280]">{tech}</span>
                  ))}
                </div>
              )}
              {project.bullets && project.bullets.length > 0 && (
                <ul className="list-disc list-inside text-[11.5px] text-[#374151] space-y-1.5">
                  {project.bullets.map((bullet: string, bulletIndex: number) => (
                    <li key={bulletIndex}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <SectionRule />
        </section>
      )}

      {/* Skills */}
      {data.skills && (
        <section className="mb-6">
          <SectionTitle>Skills</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.skills.technical && data.skills.technical.length > 0 && (
              <div>
                <h4 className="font-semibold text-[12px] text-foreground mb-2">Technical</h4>
                <div className="flex flex-wrap gap-1">
                  {data.skills.technical.map((s, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-[#F7FAFC] px-2 py-0.5 text-[11px] text-[#6b7280]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {data.skills.languages && data.skills.languages.length > 0 && (
              <div>
                <h4 className="font-semibold text-[12px] text-foreground mb-2">Languages</h4>
                <div className="flex flex-wrap gap-1">
                  {data.skills.languages.map((s, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-[#F7FAFC] px-2 py-0.5 text-[11px] text-[#6b7280]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {data.skills.soft && data.skills.soft.length > 0 && (
              <div>
                <h4 className="font-semibold text-[12px] text-foreground mb-2">Soft Skills</h4>
                <div className="flex flex-wrap gap-1">
                  {data.skills.soft.map((s, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-[#F7FAFC] px-2 py-0.5 text-[11px] text-[#6b7280]">{s}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
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
