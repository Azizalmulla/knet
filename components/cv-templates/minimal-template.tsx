'use client';

import { CVData } from '@/lib/cv-schemas';

interface MinimalTemplateProps {
  data: CVData;
}

export function MinimalTemplate({ data }: MinimalTemplateProps) {
  return (
    <div className="max-w-4xl mx-auto bg-white p-8 shadow-lg print:shadow-none">
      {/* Header */}
      <header className="text-center border-b pb-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.fullName}</h1>
        <div className="flex justify-center items-center gap-4 text-sm text-gray-600">
          <span>{data.email}</span>
          <span>•</span>
          <span>{data.phone}</span>
          <span>•</span>
          <span>{data.location}</span>
        </div>
      </header>

      {/* Summary */}
      {data.summary && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Professional Summary</h2>
          <p className="text-gray-700 leading-relaxed">{data.summary}</p>
        </section>
      )}

      {/* Experience */}
      {data.experience && data.experience.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Experience</h2>
          {data.experience.map((exp, index) => (
            <div key={index} className="mb-4">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-medium text-gray-900">{exp.position}</h3>
                <span className="text-sm text-gray-600">
                  {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                </span>
              </div>
              <p className="text-gray-700 mb-2">{exp.company}</p>
              {exp.bullets && exp.bullets.length > 0 && (
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {exp.bullets.map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      {data.education && data.education.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Education</h2>
          {data.education.map((edu, index) => (
            <div key={index} className="mb-3">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-medium text-gray-900">{edu.degree} in {edu.field}</h3>
                <span className="text-sm text-gray-600">
                  {edu.startDate} - {edu.endDate || 'Present'}
                </span>
              </div>
              <p className="text-gray-700">{edu.institution}</p>
              {edu.gpa && <p className="text-sm text-gray-600">GPA: {edu.gpa}</p>}
            </div>
          ))}
        </section>
      )}

      {/* Projects */}
      {data.projects && data.projects.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Projects</h2>
          {data.projects.map((project, index) => (
            <div key={index} className="mb-4">
              <h3 className="font-medium text-gray-900 mb-1">{project.name}</h3>
              <p className="text-sm text-gray-700 mb-2">{project.description}</p>
              {project.technologies && project.technologies.length > 0 && (
                <p className="text-xs text-gray-600 mb-2">
                  Technologies: {project.technologies.join(', ')}
                </p>
              )}
              {project.bullets && project.bullets.length > 0 && (
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  {project.bullets.map((bullet, bulletIndex) => (
                    <li key={bulletIndex}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Skills */}
      {data.skills && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Skills</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.skills.technical && data.skills.technical.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Technical</h4>
                <p className="text-sm text-gray-700">{data.skills.technical.join(', ')}</p>
              </div>
            )}
            {data.skills.languages && data.skills.languages.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Languages</h4>
                <p className="text-sm text-gray-700">{data.skills.languages.join(', ')}</p>
              </div>
            )}
            {data.skills.soft && data.skills.soft.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Soft Skills</h4>
                <p className="text-sm text-gray-700">{data.skills.soft.join(', ')}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
