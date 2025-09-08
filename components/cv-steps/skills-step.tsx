'use client';

import { useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';

interface SkillsStepProps {
  form: UseFormReturn<any>;
}

export function SkillsStep({ form }: SkillsStepProps) {
  const { setValue, watch } = form;
  const [newSkills, setNewSkills] = useState({
    technical: '',
    languages: '',
    soft: '',
  });

  const addSkill = (category: 'technical' | 'languages' | 'soft') => {
    const skill = newSkills[category].trim();
    if (skill) {
      const currentSkills = watch(`skills.${category}`) || [];
      setValue(`skills.${category}`, [...currentSkills, skill]);
      setNewSkills(prev => ({ ...prev, [category]: '' }));
    }
  };

  const removeSkill = (category: 'technical' | 'languages' | 'soft', index: number) => {
    const currentSkills = watch(`skills.${category}`) || [];
    setValue(`skills.${category}`, currentSkills.filter((_: any, i: number) => i !== index));
  };

  const skillCategories = [
    { key: 'technical' as const, title: 'Technical Skills', placeholder: 'JavaScript, Python, React...' },
    { key: 'languages' as const, title: 'Languages', placeholder: 'English (Native), Arabic (Fluent)...' },
    { key: 'soft' as const, title: 'Soft Skills', placeholder: 'Leadership, Communication, Problem Solving...' },
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
              {watch(`skills.${key}`)?.map((skill: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-zinc-100 text-zinc-800"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(key, index)}
                    className="ml-2 text-zinc-500 hover:text-zinc-700"
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
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => addSkill(key)}
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
