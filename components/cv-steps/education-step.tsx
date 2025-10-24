'use client';

import { useState } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/language';

export function EducationStep() {
  const { register, control, formState: { errors }, setValue, watch, setError, clearErrors } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'education',
  });
  const { t } = useLanguage();

  const addEducation = () => {
    append({
      institution: '',
      degree: '',
      fieldOfStudy: '',
      startDate: '',
      endDate: '',
      currentlyStudying: false,
      gpa: '',
      description: '',
    });
  };

  return (
    <div className="space-y-6">
      {fields.map((field, index) => (
        <Card key={field.id} className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">{t('step_education')} {index + 1}</CardTitle>
            {fields.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => remove(index)}
                className="text-destructive hover:text-destructive/90"
                aria-label="Remove education"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`institution-${index}`}>{t('edu_institution')} *</Label>
                <Input
                  id={`institution-${index}`}
                  {...register(`education.${index}.institution`)}
                  placeholder={t('edu_institution_placeholder')}
                  aria-invalid={!!(errors.education as any)?.[index]?.institution}
                  aria-describedby={(errors.education as any)?.[index]?.institution ? `institution-${index}-error` : undefined}
                  data-testid={`field-education-${index}-institution`}
                />
                {(errors.education as any)?.[index]?.institution && (
                  <p id={`institution-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-education-${index}-institution`}>
                    {(errors.education as any)[index]?.institution?.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`degree-${index}`}>{t('edu_degree')} *</Label>
                <Input
                  id={`degree-${index}`}
                  {...register(`education.${index}.degree`)}
                  placeholder={t('edu_degree_placeholder')}
                  aria-invalid={!!(errors.education as any)?.[index]?.degree}
                  aria-describedby={(errors.education as any)?.[index]?.degree ? `degree-${index}-error` : undefined}
                  data-testid={`field-education-${index}-degree`}
                />
                {(errors.education as any)?.[index]?.degree && (
                  <p id={`degree-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-education-${index}-degree`}>
                    {(errors.education as any)[index]?.degree?.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor={`field-${index}`}>{t('edu_field')} *</Label>
                <Input
                  id={`field-${index}`}
                  {...register(`education.${index}.fieldOfStudy`)}
                  placeholder={t('edu_field_placeholder')}
                  aria-invalid={!!(errors.education as any)?.[index]?.fieldOfStudy}
                  aria-describedby={(errors.education as any)?.[index]?.fieldOfStudy ? `field-${index}-error` : undefined}
                  data-testid={`field-education-${index}-field`}
                />
                {(errors.education as any)?.[index]?.fieldOfStudy && (
                  <p id={`field-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-education-${index}-field`}>
                    {(errors.education as any)[index]?.fieldOfStudy?.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`startDate-${index}`}>{t('edu_start_date')} *</Label>
                <Input
                  id={`startDate-${index}`}
                  type="month"
                  {...register(`education.${index}.startDate`)}
                  placeholder={t('edu_start_placeholder')}
                  aria-invalid={!!(errors.education as any)?.[index]?.startDate}
                  aria-describedby={(errors.education as any)?.[index]?.startDate ? `startDate-${index}-error` : undefined}
                  data-testid={`field-education-${index}-startDate`}
                />
                {(errors.education as any)?.[index]?.startDate && (
                  <p id={`startDate-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-education-${index}-startDate`}>
                    {(errors.education as any)[index]?.startDate?.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{t('date_format_hint')}</p>
              </div>
              <div />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    id={`current-${index}`}
                    type="checkbox"
                    {...register(`education.${index}.currentlyStudying`, {
                      onChange: (e) => {
                        const checked = (e.target as HTMLInputElement).checked;
                        setValue(`education.${index}.endDate`, checked ? 'Present' : '');
                      },
                    })}
                    className="ltr:mr-2 rtl:ml-2"
                    data-testid={`field-education-${index}-current`}
                  />
                  <Label htmlFor={`current-${index}`}>{t('edu_currently_studying')}</Label>
                </div>

                {!watch(`education.${index}.currentlyStudying`) && (
                  <>
                    <Label htmlFor={`endDate-${index}`}>{t('edu_end_date')}</Label>
                    <Input
                      id={`endDate-${index}`}
                      type="month"
                      {...register(`education.${index}.endDate`, {
                        onBlur: () => {
                          try {
                            const s = (watch(`education.${index}.startDate`) || '').toString();
                            const e = (watch(`education.${index}.endDate`) || '').toString();
                            if (s && e && s > e) {
                              setError(`education.${index}.endDate` as any, { type: 'validate', message: t('date_range_invalid') });
                            } else {
                              clearErrors(`education.${index}.endDate` as any);
                            }
                          } catch {}
                        }
                      })}
                      placeholder={t('edu_end_placeholder')}
                      aria-invalid={!!(errors.education as any)?.[index]?.endDate}
                      aria-describedby={(errors.education as any)?.[index]?.endDate ? `endDate-${index}-error` : undefined}
                      data-testid={`field-education-${index}-endDate`}
                    />
                    {(errors.education as any)?.[index]?.endDate && (
                      <p id={`endDate-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-education-${index}-endDate`}>
                        {(errors.education as any)[index]?.endDate?.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{t('date_format_hint')}</p>
                  </>
                )}
              </div>
            </div>

            <details className="mt-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">{t('edu_gpa_achievements_label')}</summary>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`gpa-${index}`}>{t('edu_gpa')}</Label>
                  <Input
                    id={`gpa-${index}`}
                    {...register(`education.${index}.gpa`)}
                    placeholder="3.5"
                    aria-invalid={!!(errors.education as any)?.[index]?.gpa}
                    aria-describedby={(errors.education as any)?.[index]?.gpa ? `gpa-${index}-error` : undefined}
                    data-testid={`field-education-${index}-gpa`}
                  />
                  {(errors.education as any)?.[index]?.gpa && (
                    <p id={`gpa-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-education-${index}-gpa`}>
                      {(errors.education as any)[index]?.gpa?.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor={`description-${index}`}>Achievements</Label>
                  <Textarea
                    id={`description-${index}`}
                    aria-label="Description"
                    {...register(`education.${index}.description`)}
                    placeholder={t('edu_achievements_placeholder')}
                    rows={3}
                    data-testid={`field-education-${index}-description`}
                  />
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addEducation}
        className="w-full"
      >
        <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
        {t('edu_add_education')}
      </Button>
    </div>
  );
}
