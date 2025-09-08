'use client';

import { CVData } from '@/lib/cv-schemas';

interface CreativeTemplateProps {
  data: CVData;
}

export function CreativeTemplate({ data }: CreativeTemplateProps) {
  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none">
      <div className="grid grid-cols-1 md:grid-cols-3 min-h-screen">
        {/* Sidebar */}
        <div className="bg-gradient-to-b from-blue-600 to-purple-700 text-white p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{data.fullName}</h1>
            <div className="space-y-2 text-sm">
              <p>{data.email}</p>
              <p>{data.phone}</p>
              <p>{data.location}</p>
            </div>
          </div>

          {/* Skills */}
          {data.skills && (
            <div className="mb-8">
              <h2 className="text-lg font-bold mb-4 border-b border-white/30 pb-2">Skills</h2>
              
              {data.skills.technical && data.skills.technical.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Technical</h4>
                  <div className="space-y-1">
                    {data.skills.technical.map((skill, index) => (
                      <div key={index} className="text-sm">{skill}</div>
                    ))}
                  </div>
                </div>
              )}

              {data.skills.languages && data.skills.languages.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Languages</h4>
                  <div className="space-y-1">
                    {data.skills.languages.map((skill, index) => (
                      <div key={index} className="text-sm">{skill}</div>
                    ))}
                  </div>
                </div>
              )}

              {data.skills.soft && data.skills.soft.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Soft Skills</h4>
                  <div className="space-y-1">
                    {data.skills.soft.map((skill, index) => (
                      <div key={index} className="text-sm">{skill}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Education */}
          {data.education && data.education.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4 border-b border-white/30 pb-2">Education</h2>
              {data.education.map((edu, index) => (
                <div key={index} className="mb-4">
                  <h3 className="font-semibold text-sm">{edu.degree}</h3>
                  <p className="text-sm opacity-90">{edu.field}</p>
                  <p className="text-xs opacity-75">{edu.institution}</p>
                  <p className="text-xs opacity-75">
                    {edu.startDate} - {edu.endDate || 'Present'}
                  </p>
                  {edu.gpa && <p className="text-xs opacity-75">GPA: {edu.gpa}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="col-span-2 p-8">
          {/* Summary */}
          {data.summary && (
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 relative">
                Professional Summary
                <div className="absolute bottom-0 left-0 w-12 h-1 bg-gradient-to-r from-blue-600 to-purple-700"></div>
              </h2>
              <p className="text-gray-700 leading-relaxed">{data.summary}</p>
            </section>
          )}

          {/* Experience */}
          {data.experience && data.experience.length > 0 && (
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 relative">
                Experience
                <div className="absolute bottom-0 left-0 w-12 h-1 bg-gradient-to-r from-blue-600 to-purple-700"></div>
              </h2>
              {data.experience.map((exp, index) => (
                <div key={index} className="mb-6 relative pl-6">
                  <div className="absolute left-0 top-2 w-3 h-3 bg-gradient-to-r from-blue-600 to-purple-700 rounded-full"></div>
                  <div className="absolute left-1.5 top-5 w-0.5 h-full bg-gray-200"></div>
                  
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{exp.position}</h3>
                      <p className="text-blue-600 font-medium">{exp.company}</p>
                    </div>
                    <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                      {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
                    </span>
                  </div>
                  
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="text-gray-700 space-y-1">
                      {exp.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start">
                          <span className="text-blue-600 mr-2">▸</span>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6 relative">
                Projects
                <div className="absolute bottom-0 left-0 w-12 h-1 bg-gradient-to-r from-blue-600 to-purple-700"></div>
              </h2>
              {data.projects.map((project, index) => (
                <div key={index} className="mb-6 p-4 border-l-4 border-gradient-to-b from-blue-600 to-purple-700 bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
                  <p className="text-gray-700 mb-3">{project.description}</p>
                  
                  {project.technologies && project.technologies.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-2">
                        {project.technologies.map((tech, techIndex) => (
                          <span
                            key={techIndex}
                            className="bg-gradient-to-r from-blue-600 to-purple-700 text-white text-xs px-2 py-1 rounded-full"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {project.bullets && project.bullets.length > 0 && (
                    <ul className="text-gray-700 space-y-1">
                      {project.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex items-start">
                          <span className="text-purple-600 mr-2">▸</span>
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
