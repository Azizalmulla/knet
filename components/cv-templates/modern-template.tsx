'use client';

import { CVData } from '@/lib/cv-schemas';

interface ModernTemplateProps {
  data: CVData;
}

export function ModernTemplate({ data }: ModernTemplateProps) {
  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
      {/* Header */}
      <header className="bg-gray-900 text-white p-8">
        <h1 className="text-4xl font-bold mb-2">{data.fullName}</h1>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>{data.email}</span>
          <span>{data.phone}</span>
          <span>{data.location}</span>
        </div>
      </header>

      <div className="p-8">
        {/* Summary */}
        {data.summary && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-gray-900 pb-2">
              Professional Summary
            </h2>
            <p className="text-gray-700 leading-relaxed">{data.summary}</p>
          </section>
        )}

        {/* Experience */}
        {data.experience && data.experience.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-gray-900 pb-2">
              Experience
            </h2>
            {data.experience.map((exp, index) => (
              <div key={index} className="mb-6 pl-4 border-l-4 border-gray-300">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{exp.position}</h3>
                    <p className="text-gray-700 font-medium">{exp.company}</p>
                  </div>
                  <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                    {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                  </span>
                </div>
                {exp.bullets && exp.bullets.length > 0 && (
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
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
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-gray-900 pb-2">
              Education
            </h2>
            {data.education.map((edu, index) => (
              <div key={index} className="mb-4 pl-4 border-l-4 border-gray-300">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {edu.degree} in {edu.field}
                    </h3>
                    <p className="text-gray-700">{edu.institution}</p>
                  </div>
                  <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded">
                    {edu.startDate} - {edu.endDate || 'Present'}
                  </span>
                </div>
                {edu.gpa && <p className="text-sm text-gray-600 ml-4">GPA: {edu.gpa}</p>}
              </div>
            ))}
          </section>
        )}

        {/* Projects */}
        {data.projects && data.projects.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-gray-900 pb-2">
              Projects
            </h2>
            {data.projects.map((project, index) => (
              <div key={index} className="mb-6 pl-4 border-l-4 border-gray-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
                <p className="text-gray-700 mb-3">{project.description}</p>
                {project.technologies && project.technologies.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.map((tech, techIndex) => (
                        <span
                          key={techIndex}
                          className="bg-gray-900 text-white text-xs px-2 py-1 rounded"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {project.bullets && project.bullets.length > 0 && (
                  <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
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
          <section className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 border-b-2 border-gray-900 pb-2">
              Skills
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.skills.technical && data.skills.technical.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Technical Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.skills.technical.map((skill, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.skills.languages && data.skills.languages.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Languages</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.skills.languages.map((skill, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.skills.soft && data.skills.soft.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Soft Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.skills.soft.map((skill, index) => (
                      <span
                        key={index}
                        className="bg-gray-100 text-gray-800 text-sm px-3 py-1 rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
