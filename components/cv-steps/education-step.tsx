'use client';

import { useState } from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

interface EducationStepProps {
  form: UseFormReturn<any>;
}

export function EducationStep({ form }: EducationStepProps) {
  const { register, control, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'education',
  });

  const addEducation = () => {
    append({
      institution: '',
      degree: '',
      field: '',
      startDate: '',
      endDate: '',
      gpa: '',
      description: '',
    });
  };

  return (
    <div className="space-y-6">
      {fields.map((field, index) => (
        <Card key={field.id} className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">Education {index + 1}</CardTitle>
            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`education.${index}.institution`}>Institution *</Label>
                <Input
                  {...register(`education.${index}.institution`)}
                  placeholder="University of Example"
                />
                {errors.education?.[index]?.institution && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.education[index].institution.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`education.${index}.degree`}>Degree *</Label>
                <Input
                  {...register(`education.${index}.degree`)}
                  placeholder="Bachelor of Science"
                />
                {errors.education?.[index]?.degree && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.education[index].degree.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor={`education.${index}.field`}>Field of Study *</Label>
                <Input
                  {...register(`education.${index}.field`)}
                  placeholder="Computer Science"
                />
                {errors.education?.[index]?.field && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.education[index].field.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`education.${index}.startDate`}>Start Date *</Label>
                <Input
                  type="month"
                  {...register(`education.${index}.startDate`)}
                />
                {errors.education?.[index]?.startDate && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.education[index].startDate.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`education.${index}.endDate`}>End Date</Label>
                <Input
                  type="month"
                  {...register(`education.${index}.endDate`)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`education.${index}.gpa`}>GPA (Optional)</Label>
                <Input
                  {...register(`education.${index}.gpa`)}
                  placeholder="3.8/4.0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor={`education.${index}.description`}>Description</Label>
              <Textarea
                {...register(`education.${index}.description`)}
                placeholder="Relevant coursework, achievements, honors..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addEducation}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Education
      </Button>
    </div>
  );
}
