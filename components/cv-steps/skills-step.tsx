'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Award, Medal } from 'lucide-react';
import { CVData } from '@/lib/cv-schemas';
import { useLanguage } from '@/lib/language';

type SkillCategory = 'technical' | 'frameworks' | 'tools' | 'databases' | 'cloud' | 'languages' | 'soft';

export function SkillsStep() {
  const form = useFormContext<CVData>();
  const { setValue, watch } = form;
  const { t } = useLanguage();
  const [newSkills, setNewSkills] = useState<Record<SkillCategory, string>>({
    technical: '',
    frameworks: '',
    tools: '',
    databases: '',
    cloud: '',
    languages: '',
    soft: '',
  });
  const [newCertification, setNewCertification] = useState('');
  const [newAchievement, setNewAchievement] = useState('');
  const [focusKey, setFocusKey] = useState<null | SkillCategory>(null);

  const SUGGESTIONS: Record<SkillCategory, string[]> = {
    technical: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Swift', 'Kotlin', 'SQL'],
    frameworks: ['React', 'Next.js', 'Vue.js', 'Angular', 'Node.js', 'Express', 'Django', 'Flask', 'Spring Boot', 'Laravel', '.NET'],
    tools: ['Git', 'Docker', 'Kubernetes', 'VS Code', 'Jira', 'Figma', 'Postman', 'Linux', 'CI/CD', 'Webpack'],
    databases: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'Firebase', 'DynamoDB', 'Elasticsearch'],
    cloud: ['AWS', 'Google Cloud', 'Azure', 'Vercel', 'Heroku', 'DigitalOcean', 'Cloudflare', 'Netlify'],
    languages: ['English', 'Arabic', 'French', 'Spanish', 'German', 'Chinese', 'Hindi', 'Japanese'],
    soft: ['Communication', 'Problem Solving', 'Teamwork', 'Time Management', 'Adaptability', 'Leadership', 'Critical Thinking'],
  };

  const sendEvent = (event: string, value?: number, meta?: any) => {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, value, meta }),
      }).catch(() => {});
    } catch {}
  };

  const addSkill = (category: SkillCategory) => {
    const skill = newSkills[category].trim();
    if (skill) {
      const currentSkills = watch(`skills.${category}`) ?? [];
      setValue(`skills.${category}`, [...currentSkills, skill]);
      setNewSkills(prev => ({ ...prev, [category]: '' }));
      sendEvent('skills_added', 1, { category, skill });
    }
  };

  const removeSkill = (category: SkillCategory, index: number) => {
    const currentSkills = watch(`skills.${category}`) ?? [];
    setValue(`skills.${category}`, currentSkills.filter((_: any, i: number) => i !== index));
    sendEvent('skills_removed', 1, { category });
  };

  const addCertification = () => {
    const cert = newCertification.trim();
    if (cert) {
      const current = watch('certifications') ?? [];
      setValue('certifications', [...current, cert]);
      setNewCertification('');
      sendEvent('certification_added', 1, { cert });
    }
  };

  const removeCertification = (index: number) => {
    const current = watch('certifications') ?? [];
    setValue('certifications', current.filter((_: any, i: number) => i !== index));
  };

  const addAchievement = () => {
    const ach = newAchievement.trim();
    if (ach) {
      const current = watch('achievements') ?? [];
      setValue('achievements', [...current, ach]);
      setNewAchievement('');
      sendEvent('achievement_added', 1, { ach });
    }
  };

  const removeAchievement = (index: number) => {
    const current = watch('achievements') ?? [];
    setValue('achievements', current.filter((_: any, i: number) => i !== index));
  };

  const skillCategories: Array<{ key: SkillCategory; title: string; placeholder: string }> = [
    { key: 'technical', title: t('skills_technical_title') || 'Programming Languages', placeholder: t('skills_technical_placeholder') || 'e.g., JavaScript, Python' },
    { key: 'frameworks', title: 'Frameworks & Libraries', placeholder: 'e.g., React, Node.js' },
    { key: 'tools', title: 'Tools & Platforms', placeholder: 'e.g., Git, Docker' },
    { key: 'databases', title: 'Databases', placeholder: 'e.g., PostgreSQL, MongoDB' },
    { key: 'cloud', title: 'Cloud Services', placeholder: 'e.g., AWS, Azure' },
    { key: 'languages', title: t('skills_languages_title') || 'Languages', placeholder: t('skills_languages_placeholder') || 'e.g., English, Arabic' },
    { key: 'soft', title: t('skills_soft_title') || 'Soft Skills', placeholder: t('skills_soft_placeholder') || 'e.g., Communication' },
  ];

  return (
    <div className="space-y-6">
      {skillCategories.map(({ key, title, placeholder }) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="text-lg">{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {(watch(`skills.${key}`) ?? []).map((skill: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-secondary text-secondary-foreground"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(key, index)}
                    className="ltr:ml-2 rtl:mr-2 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSkills[key]}
                onChange={(e) => setNewSkills(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill(key))}
                onFocus={() => setFocusKey(key)}
                onBlur={() => setFocusKey((prev) => (prev === key ? null : prev))}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addSkill(key)}
                className="whitespace-nowrap"
              >
                + {t('skills_add')}
              </Button>
            </div>
            {/* Autosuggest chips */}
            {(() => {
              const query = newSkills[key].toLowerCase().trim();
              if (query.length < 2 || focusKey !== key) return null;
              const selected: string[] = (watch(`skills.${key}`) ?? []) as any;
              const pool = SUGGESTIONS[key] || [];
              const matches = pool
                .filter(s => s.toLowerCase().includes(query))
                .filter(s => !selected.some(sel => sel.toLowerCase() === s.toLowerCase()))
                .slice(0, 6);
              if (matches.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-2 mt-1" aria-label={`suggestions-${key}`}>
                  {matches.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => {
                        setValue(`skills.${key}`, [...selected, suggestion]);
                        setNewSkills(prev => ({ ...prev, [key]: '' }));
                        sendEvent('skills_suggest_click', 1, { category: key, suggestion });
                      }}
                      className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                      data-testid={`suggest-${key}-${suggestion}`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      ))}

      {/* Certifications Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5" />
            Certifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {(watch('certifications') ?? []).map((cert: string, index: number) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {cert}
                <button
                  type="button"
                  onClick={() => removeCertification(index)}
                  className="ltr:ml-2 rtl:mr-2 text-blue-600 hover:text-blue-800"
                  aria-label={`Remove ${cert}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newCertification}
              onChange={(e) => setNewCertification(e.target.value)}
              placeholder="e.g., AWS Solutions Architect, PMP, Google Analytics"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addCertification}
              className="whitespace-nowrap"
            >
              + Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Achievements Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Medal className="h-5 w-5" />
            Achievements & Awards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {(watch('achievements') ?? []).map((ach: string, index: number) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
              >
                {ach}
                <button
                  type="button"
                  onClick={() => removeAchievement(index)}
                  className="ltr:ml-2 rtl:mr-2 text-amber-600 hover:text-amber-800"
                  aria-label={`Remove ${ach}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newAchievement}
              onChange={(e) => setNewAchievement(e.target.value)}
              placeholder="e.g., Dean's List 2023, Hackathon Winner, Published Paper"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
            />
            <Button
              type="button"
              variant="outline"
              onClick={addAchievement}
              className="whitespace-nowrap"
            >
              + Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
