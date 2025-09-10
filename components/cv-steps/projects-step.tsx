'use client';

import { useState } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Wand2, X } from 'lucide-react';
import { useLanguage } from '@/lib/language';
 
export function ProjectsStep() {
  const { register, control, formState: { errors }, setValue, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'projects',
  });

  const [loadingAI, setLoadingAI] = useState<number | null>(null);
  const [newTech, setNewTech] = useState<{ [key: number]: string }>({});
  const { t } = useLanguage();

  const sendEvent = (event: string, value?: number, meta?: any) => {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, value, meta }),
      }).catch(() => {});
    } catch {}
  };

  const addProject = () => {
    append({
      name: '',
      description: '',
      technologies: [],
      url: '',
      bullets: [],
    });
  };

  const seedAcademicProject = () => {
    const seed = {
      name: 'AI CV Builder',
      description: 'Built a Next.js app to generate ATS-ready CVs; added template previews and PDF export.',
      technologies: ['Next.js', 'TypeScript', 'Tailwind CSS'],
      url: '',
      bullets: [
        'Developed responsive React components and a wizard flow for CV steps.',
        'Implemented AI-assisted content generation and export to PDF/DOCX.',
      ],
    };
    append(seed as any);
    sendEvent('project_seed_click', 1, { name: seed.name });
  };

  const addTechnology = (projectIndex: number) => {
    const tech = newTech[projectIndex]?.trim();
    if (tech) {
      const currentTech = watch(`projects.${projectIndex}.technologies`) || [];
      setValue(`projects.${projectIndex}.technologies`, [...currentTech, tech]);
      setNewTech(prev => ({ ...prev, [projectIndex]: '' }));
    }
  };

  const removeTechnology = (projectIndex: number, techIndex: number) => {
    const currentTech = watch(`projects.${projectIndex}.technologies`) || [];
    setValue(`projects.${projectIndex}.technologies`, currentTech.filter((_: any, i: number) => i !== techIndex));
  };

  const generateBullets = async (index: number) => {
    const description = watch(`projects.${index}.description`);
    if (!description) return;

    setLoadingAI(index);
    try {
      sendEvent('ai_bullets_clicks', 1, { feature: 'projects', index });
      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: description,
          section: 'projects',
        }),
      });

      if (response.ok) {
        const { bullets } = await response.json();
        const tidyBullets = (list: string[]) => list
          .map(b => b.trim().replace(/^[-•\s]*/, '').replace(/^(i['’]m|i am)\b/i, '').replace(/\s+/g, ' '))
          .map(b => (b[0] ? b[0].toUpperCase() + b.slice(1) : b))
          .map(b => /[.!?]$/.test(b) ? b : b + '.');
        const cleaned = tidyBullets(Array.isArray(bullets) ? bullets : []).slice(0, 5);
        setValue(`projects.${index}.bullets`, cleaned);
        sendEvent('avg_bullets_generated_per_click', cleaned.length, { feature: 'projects', index });
      }
    } catch (error) {
      console.error('Failed to generate bullets:', error);
      sendEvent('ai_bullets_fail', 1, { feature: 'projects' });
    } finally {
      setLoadingAI(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={seedAcademicProject}>
          Add an academic project idea
        </Button>
      </div>
      {fields.map((field, index) => (
        <Card key={field.id} className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">{t('step_projects')} {index + 1}</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`projects.${index}.name`}>{t('proj_name')} *</Label>
                <Input
                  {...register(`projects.${index}.name`)}
                  placeholder={t('proj_name_placeholder')}
                />
                {(errors.projects as any)?.[index]?.name && (
                  <p className="text-sm text-red-500 mt-1">
                    {(errors.projects as any)[index].name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`projects.${index}.url`}>{t('proj_url')}</Label>
                <Input
                  {...register(`projects.${index}.url`)}
                  placeholder={t('proj_url_placeholder')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`projects.${index}.description`}>{t('proj_description')} *</Label>
              <Textarea
                {...register(`projects.${index}.description`)}
                placeholder="What was the goal, your part, and outcome? e.g., Dashboard for expenses using React + Node; added charts, monthly reports."
                rows={3}
              />
              <p className="text-xs text-zinc-500 mt-1">1–2 lines describing what it does.</p>
              {(errors.projects as any)?.[index]?.description && (
                <p className="text-sm text-red-500 mt-1">
                  {(errors.projects as any)[index].description.message}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generateBullets(index)}
                disabled={loadingAI === index}
                className="mt-2"
              >
                <Wand2 className="h-4 w-4 mr-2" />
                {loadingAI === index ? t('proj_generating') : t('proj_generate_bullets')}
              </Button>
            </div>

            <div>
              <Label>{t('proj_technologies')}</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {watch(`projects.${index}.technologies`)?.map((tech: string, techIndex: number) => (
                  <span
                    key={techIndex}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-zinc-100 text-zinc-800"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTechnology(index, techIndex)}
                      className="ml-1 text-zinc-500 hover:text-zinc-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newTech[index] || ''}
                  onChange={(e) => setNewTech(prev => ({ ...prev, [index]: e.target.value }))}
                  placeholder="React"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnology(index))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTechnology(index)}
                >
                  {t('proj_add')}
                </Button>
              </div>
            </div>

            {watch(`projects.${index}.bullets`)?.length > 0 && (
              <div>
                <Label>{t('proj_generated_bullets')}</Label>
                <div className="space-y-2 mt-2">
                  {watch(`projects.${index}.bullets`).map((bullet: string, bulletIndex: number) => (
                    <div key={bulletIndex} className="flex items-start space-x-2">
                      <span className="text-sm text-zinc-500 mt-1">•</span>
                      <Input
                        value={bullet}
                        onChange={(e) => {
                          const bullets = watch(`projects.${index}.bullets`);
                          bullets[bulletIndex] = e.target.value;
                          setValue(`projects.${index}.bullets`, bullets);
                        }}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addProject}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        {t('proj_add_project')}
      </Button>
    </div>
  );
}
