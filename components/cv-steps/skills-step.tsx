'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { CVData } from '@/lib/cv-schemas';
import { useLanguage } from '@/lib/language';

export function SkillsStep() {
  const form = useFormContext<CVData>();
  const { setValue, watch } = form;
  const { t } = useLanguage();
  const [newSkills, setNewSkills] = useState({
    technical: '',
    languages: '',
    soft: '',
  });
  const [focusKey, setFocusKey] = useState<null | 'technical' | 'languages' | 'soft'>(null);

  const SUGGESTIONS: Record<'technical'|'languages'|'soft', string[]> = {
    technical: ['React','TypeScript','JavaScript','Node.js','Next.js','Tailwind CSS','SQL','PostgreSQL','Python','Java','Docker','Git','AWS'],
    languages: ['English','Arabic'],
    soft: ['Communication','Problem Solving','Teamwork','Time Management','Adaptability','Leadership','Attention to Detail'],
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

  const addSkill = (category: 'technical' | 'languages' | 'soft') => {
    const skill = newSkills[category].trim();
    if (skill) {
      const currentSkills = watch(`skills.${category}`) ?? [];
      setValue(`skills.${category}`, [...currentSkills, skill]);
      setNewSkills(prev => ({ ...prev, [category]: '' }));
      sendEvent('skills_added', 1, { category, skill });
    }
  };

  const removeSkill = (category: 'technical' | 'languages' | 'soft', index: number) => {
    const currentSkills = watch(`skills.${category}`) ?? [];
    setValue(`skills.${category}`, currentSkills.filter((_: any, i: number) => i !== index));
    sendEvent('skills_removed', 1, { category });
  };

  const skillCategories = [
    { key: 'technical' as const, title: t('skills_technical_title'), placeholder: t('skills_technical_placeholder') },
    { key: 'languages' as const, title: t('skills_languages_title'), placeholder: t('skills_languages_placeholder') },
    { key: 'soft' as const, title: t('skills_soft_title'), placeholder: t('skills_soft_placeholder') },
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
    </div>
  );
}
