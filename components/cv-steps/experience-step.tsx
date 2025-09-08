'use client';

import { useState } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { CVData } from '@/lib/cv-schemas';

interface ExperienceStepProps {
  form: UseFormReturn<any>;
  cvData: Partial<CVData>;
}

export function ExperienceStep({ form, cvData }: ExperienceStepProps) {
  const { register, control, formState: { errors }, setValue, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'experience',
  });

  const [loadingAI, setLoadingAI] = useState<number | null>(null);

  const addExperience = () => {
    append({
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      bullets: [],
    });
  };

  const generateBullets = async (index: number) => {
    const description = watch(`experience.${index}.description`);
    if (!description) return;

    setLoadingAI(index);
    try {
      const response = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: description,
          section: 'experience',
        }),
      });

      if (response.ok) {
        const { bullets } = await response.json();
        setValue(`experience.${index}.bullets`, bullets);
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
            <CardTitle className="text-lg">Experience {index + 1}</CardTitle>
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
                <Label htmlFor={`experience.${index}.company`}>Company *</Label>
                <Input
                  {...register(`experience.${index}.company`)}
                  placeholder="Tech Corp"
                />
                {errors.experience?.[index]?.company && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.experience[index].company.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`experience.${index}.position`}>Position *</Label>
                <Input
                  {...register(`experience.${index}.position`)}
                  placeholder="Software Engineer"
                />
                {errors.experience?.[index]?.position && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.experience[index].position.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`experience.${index}.startDate`}>Start Date *</Label>
                <Input
                  type="month"
                  {...register(`experience.${index}.startDate`)}
                />
                {errors.experience?.[index]?.startDate && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.experience[index].startDate.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`experience.${index}.endDate`}>End Date</Label>
                <Input
                  type="month"
                  {...register(`experience.${index}.endDate`)}
                  disabled={watch(`experience.${index}.current`)}
                />
                <div className="flex items-center mt-2">
                  <input
                    type="checkbox"
                    {...register(`experience.${index}.current`)}
                    className="mr-2"
                  />
                  <Label className="text-sm">Currently working here</Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor={`experience.${index}.description`}>Raw Description</Label>
              <Textarea
                {...register(`experience.${index}.description`)}
                placeholder="Describe your responsibilities and achievements in raw notes..."
                rows={3}
              />
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

            {watch(`experience.${index}.bullets`)?.length > 0 && (
              <div>
                <Label>Generated Bullet Points</Label>
                <div className="space-y-2 mt-2">
                  {watch(`experience.${index}.bullets`).map((bullet: string, bulletIndex: number) => (
                    <div key={bulletIndex} className="flex items-start space-x-2">
                      <span className="text-sm text-zinc-500 mt-1">•</span>
                      <Input
                        value={bullet}
                        onChange={(e) => {
                          const bullets = watch(`experience.${index}.bullets`);
                          bullets[bulletIndex] = e.target.value;
                          setValue(`experience.${index}.bullets`, bullets);
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
        onClick={addExperience}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Experience
      </Button>
    </div>
  );
}
