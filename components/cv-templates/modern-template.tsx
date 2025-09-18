'use client';

import { CVData } from '@/lib/cv-schemas';
import { Inter, Noto_Kufi_Arabic } from 'next/font/google';
import { Mail, Phone } from 'lucide-react';

const inter = Inter({ subsets: ['latin'], weight: ['400','600','700'] });
const noto = Noto_Kufi_Arabic({ subsets: ['arabic'], weight: ['400','700'] });

interface ModernTemplateProps {
  data: CVData;
}

export function ModernTemplate({ data }: ModernTemplateProps) {
  const isAR = (data as any)?.language === 'ar';
  const fontClass = isAR ? noto.className : inter.className;
  return (
    <div className={`cv-root max-w-4xl mx-auto bg-background text-foreground shadow-sm print:shadow-none ${fontClass} ${isAR ? 'rtl' : 'ltr'}`} dir={isAR ? 'rtl' : 'ltr'}>
      {/* Header Bar */}
      <header className="px-8 py-6 text-white" style={{ backgroundColor: '#0A5D86' }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="text-[22px] md:text-[24px] font-bold tracking-[0.02em]">{data.fullName}</h1>
            {data.location && <p className="text-sm/6 opacity-90 mt-1">{data.location}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.email && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs">
                <Mail className="h-3.5 w-3.5" /> {data.email}
              </span>
            )}
            {data.phone && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs">
                <Phone className="h-3.5 w-3.5" /> {data.phone}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Two Columns */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left (65%) */}
        <div className="md:col-span-8 space-y-6">
          {data.summary && (
            <section>
              <h2 className="text-[12px] uppercase font-bold tracking-[0.05em]" style={{ color: '#0A5D86' }}>Professional Summary</h2>
              <p className="text-[12px] text-[#374151] leading-[1.5] mt-1">{data.summary}</p>
              <div className="h-px bg-[#E6EEF5] mt-3" />
            </section>
          )}

          {data.experience && data.experience.length > 0 && (
            <section>
              <h2 className="text-[12px] uppercase font-bold tracking-[0.05em] mb-2" style={{ color: '#0A5D86' }}>Experience</h2>
              {data.experience.map((exp, index) => (
                <div key={index} className="mb-4">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-[13px] text-foreground tracking-tight">{exp.position}</h3>
                    <span className="text-[11px] text-[#6b7280] rounded-full bg-[#F7FAFC] px-2 py-0.5">
                      {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                    </span>
                  </div>
                  <p className="text-[#6b7280] font-medium text-[12px]">{exp.company}</p>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="mt-2 list-disc ltr:ml-4 rtl:mr-4 text-[11.5px] text-[#374151] space-y-1.5">
                      {exp.bullets.map((bullet: string, i: number) => (
                        <li key={i}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <div className="h-px bg-[#E6EEF5] mt-3" />
            </section>
          )}

          {data.projects && data.projects.length > 0 && (
            <section>
              <h2 className="text-[12px] uppercase font-bold tracking-[0.05em] mb-2" style={{ color: '#0A5D86' }}>Projects</h2>
              {data.projects.map((project, index) => (
                <div key={index} className="mb-4">
                  <h3 className="font-semibold text-[13px] text-foreground mb-1 tracking-tight">{project.name}</h3>
                  <p className="text-[#6b7280] mb-2 text-[12px]">{project.description}</p>
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {project.technologies.map((tech: string, techIndex: number) => (
                        <span key={techIndex} className="inline-flex items-center rounded-full bg-[#F7FAFC] px-2 py-0.5 text-[11px] text-[#6b7280]">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}
                  {project.bullets && project.bullets.length > 0 && (
                    <ul className="list-disc list-inside text-[#374151] space-y-1.5 ltr:ml-4 rtl:mr-4 text-[11.5px]">
                      {project.bullets.map((bullet: string, bulletIndex: number) => (
                        <li key={bulletIndex}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>

        {/* Right (35%) Sidebar */}
        <aside className="md:col-span-4 space-y-6 p-4 rounded-xl" style={{ backgroundColor: '#F7FAFC' }}>
          {data.skills && (
            <div>
              <h3 className="text-[12px] uppercase font-bold tracking-[0.05em] mb-2" style={{ color: '#0A5D86' }}>Skills</h3>
              {data.skills.technical && data.skills.technical.length > 0 && (
                <div className="mb-3">
                  <div className="flex flex-wrap gap-1">
                    {data.skills.technical.map((skill, index) => (
                      <span key={index} className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] text-[#0A5D86] border" style={{ borderColor: '#E6EEF5' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.skills.languages && data.skills.languages.length > 0 && (
                <div className="mb-3">
                  <h4 className="font-semibold text-[12px] mb-1">Languages</h4>
                  <div className="flex flex-wrap gap-1">
                    {data.skills.languages.map((skill, index) => (
                      <span key={index} className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] text-[#0A5D86] border" style={{ borderColor: '#E6EEF5' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(data as any).certifications && Array.isArray((data as any).certifications) && (data as any).certifications.length > 0 && (
                <div>
                  <h4 className="font-semibold text-[12px] mb-1">Certifications</h4>
                  <ul className="list-disc ltr:ml-4 rtl:mr-4 text-[11.5px] text-[#374151]">
                    {(data as any).certifications.map((c: string, i: number) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
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
