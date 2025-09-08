'use client';

import { useState } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Wand2, X } from 'lucide-react';
import { CVData } from '@/lib/cv-schemas';

interface ProjectsStepProps {
  form: UseFormReturn<any>;
  cvData: Partial<CVData>;
}

export function ProjectsStep({ form, cvData }: ProjectsStepProps) {
  const { register, control, formState: { errors }, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'projects',
  });

  const [loadingAI, setLoadingAI] = useState<number | null>(null);
  const [newTech, setNewTech] = useState<{ [key: number]: string }>({});

  const addProject = () => {
    append({
      name: '',
      description: '',
      technologies: [],
      url: '',
      bullets: [],
    });
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
        setValue(`projects.${index}.bullets`, bullets);
      }
    } catch (error) {
      console.error('Failed to generate bullets:', error);
    } finally {
      setLoadingAI(null);
    }
  };

  return (
    <div className="space-y-6">
      {fields.map((field, index) => (
        <Card key={field.id} className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Project {index + 1}</CardTitle>
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
                <Label htmlFor={`projects.${index}.name`}>Project Name *</Label>
                <Input
                  {...register(`projects.${index}.name`)}
                  placeholder="My Awesome Project"
                />
                {errors.projects?.[index]?.name && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.projects[index].name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`projects.${index}.url`}>URL (Optional)</Label>
                <Input
                  {...register(`projects.${index}.url`)}
                  placeholder="https://github.com/user/project"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`projects.${index}.description`}>Description *</Label>
              <Textarea
                {...register(`projects.${index}.description`)}
                placeholder="Describe what the project does and your role..."
                rows={3}
              />
              {errors.projects?.[index]?.description && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.projects[index].description.message}
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
                {loadingAI === index ? 'Generating...' : 'Generate ATS Bullets'}
              </Button>
            </div>

            <div>
              <Label>Technologies</Label>
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
                  placeholder="Add technology"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnology(index))}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTechnology(index)}
                >
                  Add
                </Button>
              </div>
            </div>

            {watch(`projects.${index}.bullets`)?.length > 0 && (
              <div>
                <Label>Generated Bullet Points</Label>
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
        Add Project
      </Button>
    </div>
  );
}
