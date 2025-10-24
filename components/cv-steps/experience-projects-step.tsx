'use client';

import { useState, useRef, useEffect } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Wand2, X, ChevronDown, ChevronUp, Briefcase, FolderOpen } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { toast } from 'sonner';
import { generateAIBullets, AIBulletsError } from '@/lib/ai-bullets';

interface ExperienceProjectItem {
  type: 'experience' | 'project';
  // Experience fields
  company?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  // Project fields
  name?: string;
  url?: string;
  technologies?: string[];
  // Common fields
  description: string;
  bullets: string[];
}

export function ExperienceProjectsStep() {
  const { register, control, formState: { errors }, setValue, watch, getValues, setError, clearErrors } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'experienceProjects',
  });

  const [loadingAI, setLoadingAI] = useState<number | null>(null);
  const [disabledButtons, setDisabledButtons] = useState<Set<number>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [newTech, setNewTech] = useState<{ [key: number]: string }>({});
  const { t, lang } = useLanguage();

  // Abort controllers and timers per index to avoid hangs
  const abortRef = useRef<Map<number, AbortController>>(new Map());
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  // Track active operation to avoid race conditions
  const opCounterRef = useRef(0);
  const activeOpRef = useRef<{ id: number; index: number } | null>(null);

  const sendEvent = (event: string, value?: number, meta?: any) => {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, value, meta }),
      }).catch(() => {});
    } catch {}
  };

  const addExperience = () => {
    const newIndex = fields.length;
    append({
      type: 'experience',
      company: '',
      position: '',
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      bullets: [],
    } as ExperienceProjectItem);
    setExpandedItems(prev => new Set(prev).add(newIndex));
  };

  const addProject = () => {
    const newIndex = fields.length;
    append({
      type: 'project',
      name: '',
      url: '',
      technologies: [],
      startDate: '',
      endDate: '',
      current: false,
      description: '',
      bullets: [],
    } as ExperienceProjectItem);
    setExpandedItems(prev => new Set(prev).add(newIndex));
  };

  const toggleExpanded = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const addTechnology = (itemIndex: number) => {
    const tech = newTech[itemIndex]?.trim();
    if (tech) {
      const currentTech = watch(`experienceProjects.${itemIndex}.technologies`) || [];
      setValue(`experienceProjects.${itemIndex}.technologies`, [...currentTech, tech]);
      setNewTech(prev => ({ ...prev, [itemIndex]: '' }));
    }
  };

  const removeTechnology = (itemIndex: number, techIndex: number) => {
    const currentTech = watch(`experienceProjects.${itemIndex}.technologies`) || [];
    setValue(`experienceProjects.${itemIndex}.technologies`, currentTech.filter((_: any, i: number) => i !== techIndex));
  };

  const seedAcademicProject = () => {
    const newIndex = fields.length;
    const seed = {
      type: 'project' as const,
      name: 'AI CV Builder',
      description: 'Built a Next.js app to generate ATS-ready CVs; added template previews and PDF export.',
      technologies: ['Next.js', 'TypeScript', 'Tailwind CSS'],
      url: '',
      bullets: [
        'Developed responsive React components and a wizard flow for CV steps.',
        'Implemented AI-assisted content generation and export to PDF/DOCX.',
      ],
    };
    append(seed);
    setExpandedItems(prev => new Set(prev).add(newIndex));
    sendEvent('project_seed_click', 1, { name: seed.name });
  };

  const serializeSingleItem = (item: any) => {
    if (!item) return '';
    const parts = [];
    
    if (item.type === 'experience') {
      if (item.position) parts.push(`Position: ${item.position}`);
      if (item.company) parts.push(`Company: ${item.company}`);
      if (item.startDate) parts.push(`Start: ${item.startDate}`);
      if (item.endDate || item.current) parts.push(`End: ${item.current ? 'Present' : item.endDate}`);
    } else if (item.type === 'project') {
      if (item.name) parts.push(`Project: ${item.name}`);
      if (item.url) parts.push(`URL: ${item.url}`);
      if (item.technologies?.length > 0) parts.push(`Technologies: ${item.technologies.join(', ')}`);
    }
    
    if (item.description) parts.push(`Description: ${item.description}`);
    if (item.bullets?.length > 0) parts.push(`Bullets: ${item.bullets.join('; ')}`);
    return parts.join('\n');
  };

  const generateBullets = async (index: number) => {
    const values = getValues();
    const currentItem = values.experienceProjects?.[index];
    
    if (!currentItem?.description && !currentItem?.position && !currentItem?.name) {
      toast.error('Add a short description, then try again.');
      return;
    }

    // Abort any prior in-flight request for this index
    try {
      abortRef.current.get(index)?.abort();
    } catch {}
    const controller = new AbortController();
    abortRef.current.set(index, controller);
    
    // 15s global timeout
    try {
      const prevTimer = timersRef.current.get(index);
      if (prevTimer) clearTimeout(prevTimer as any);
    } catch {}
    const timeoutId = setTimeout(() => {
      try { controller.abort(); } catch {}
      if (activeOpRef.current?.id === reqId && activeOpRef.current?.index === index) {
        activeOpRef.current = null;
        setLoadingAI(prev => (prev === index ? null : prev));
        sendEvent('ai_bullets_timeout', 1, { index });
      }
    }, 15000);
    timersRef.current.set(index, timeoutId);

    // Mark this operation as active and show loading for this index
    const reqId = ++opCounterRef.current;
    activeOpRef.current = { id: reqId, index };
    setLoadingAI(index);

    const isActive = () => activeOpRef.current?.id === reqId && activeOpRef.current?.index === index;
    
    try {
      const currentLocale = lang === 'ar' ? 'ar' : 'en';
      const section = currentItem.type === 'experience' ? 'experience' : 'projects';
      // Click metric
      sendEvent('ai_bullets_clicks', 1, { index, type: currentItem.type });

      const bullets = await generateAIBullets({
        section: section as any,
        description: currentItem?.description || '',
        experience: section === 'experience' ? {
          position: currentItem?.position || '',
          company: currentItem?.company || '',
          location: currentItem?.location || '',
          startDate: currentItem?.startDate || '',
          endDate: currentItem?.endDate || '',
          current: !!currentItem?.current,
          description: currentItem?.description || '',
          bullets: Array.isArray(currentItem?.bullets) ? currentItem.bullets : [],
          technologies: Array.isArray(currentItem?.technologies) ? currentItem.technologies : [],
        } : undefined,
        project: section === 'projects' ? {
          name: currentItem?.name || '',
          description: currentItem?.description || '',
          technologies: Array.isArray(currentItem?.technologies) ? currentItem.technologies : [],
          url: currentItem?.url || '',
          bullets: Array.isArray(currentItem?.bullets) ? currentItem.bullets : [],
        } : undefined,
        personalInfo: {
          fullName: (values as any).fullName?.trim?.() || (values as any)?.personalInfo?.fullName || '',
          email: (values as any).email?.trim?.() || (values as any)?.personalInfo?.email || '',
        },
        jobDescription: (values as any)?.review?.jobDescription?.slice(0, 3000) || '',
        locale: currentLocale,
        signal: controller.signal,
      })

      if (!isActive()) return; // stale
      if (bullets.length > 0) {
        setValue(`experienceProjects.${index}.bullets`, bullets)
        toast.success('ATS-optimized bullets generated')
        sendEvent('avg_bullets_generated_per_click', bullets.length, { index, type: currentItem.type })
      } else {
        toast.info('No bullets generated')
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('⏳ Bullets generation aborted (timeout or manual).');
        toast.error('Request timed out. Please try again');
        sendEvent('ai_bullets_timeout', 1, { index });
      } else if (error instanceof AIBulletsError) {
        if (error.code === 422) {
          (error.needs || []).forEach((path: string) => {
            const field = path.replace(/^personalInfo\./, '');
            try { setError(field as any, { type: 'ai', message: 'Required for AI' }); } catch {}
          })
          toast.error('Add the highlighted fields, then retry')
          sendEvent('422_count', 1, { feature: 'ai_bullets' })
        } else if (error.code === 429) {
          toast.error('Model is busy — try again')
          setDisabledButtons(prev => new Set(prev).add(index))
          setTimeout(() => {
            setDisabledButtons(prev => {
              const next = new Set(prev)
              next.delete(index)
              return next
            })
          }, 10000)
          sendEvent('429_count', 1, { feature: 'ai_bullets' })
        } else {
          console.error('❌ Generate bullets error:', error)
          toast.error('Something went wrong. Please try again')
          sendEvent('ai_bullets_fail', 1)
        }
      } else {
        console.error('❌ Generate bullets error:', error);
        toast.error('Something went wrong. Please try again');
        sendEvent('ai_bullets_fail', 1);
      }
    } finally {
      // Clear timeout and abort controller for this index
      try {
        const t = timersRef.current.get(index);
        if (t) clearTimeout(t as any);
        timersRef.current.delete(index);
      } catch {}
      abortRef.current.delete(index);
      // Always clear loading to avoid hanging UI
      setLoadingAI(null);
      if (activeOpRef.current?.id === reqId) {
        activeOpRef.current = null;
      }
    }
  };

  // Cleanup on unmount: abort all
  useEffect(() => {
    return () => {
      try {
        abortRef.current.forEach((c) => c.abort());
      } catch {}
      try {
        timersRef.current.forEach((t) => clearTimeout(t as any));
      } catch {}
      abortRef.current.clear();
      timersRef.current.clear();
    };
  }, []);

  const getItemTitle = (item: any, index: number) => {
    if (!item) return `Item ${index + 1}`;
    
    if (item.type === 'experience') {
      return item.position || item.company || `Experience ${index + 1}`;
    } else {
      return item.name || `Project ${index + 1}`;
    }
  };

  const getItemSubtitle = (item: any) => {
    if (!item) return '';
    
    if (item.type === 'experience') {
      const parts = [];
      if (item.company) parts.push(item.company);
      if (item.startDate) {
        const endDate = item.current ? 'Present' : item.endDate;
        parts.push(`${item.startDate}${endDate ? ` - ${endDate}` : ''}`);
      }
      return parts.join(' • ');
    } else {
      const parts = [];
      if (item.technologies?.length > 0) {
        parts.push(item.technologies.slice(0, 3).join(', '));
      }
      if (item.url) parts.push(t('has_url'));
      return parts.join(' • ');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('experience_projects_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('experience_projects_subtitle')}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={seedAcademicProject}>
          {t('add_example_project')}
        </Button>
      </div>

      {fields.map((field, index) => {
        const item = watch(`experienceProjects.${index}`);
        const isExpanded = expandedItems.has(index);
        
        return (
          <Card key={field.id} className="relative">
            <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(index)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      {item?.type === 'experience' ? (
                        <Briefcase className="h-4 w-4" />
                      ) : (
                        <FolderOpen className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{getItemTitle(item, index)}</CardTitle>
                      {getItemSubtitle(item) && (
                        <p className="text-sm text-muted-foreground">{getItemSubtitle(item)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(index);
                        }}
                        className="text-destructive hover:text-destructive/90"
                        aria-label={`Remove ${item?.type === 'experience' ? 'experience' : 'project'}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {/* Type Selection */}
                  <div>
                    <Label>{t('type_label')} *</Label>
                    <Select
                      value={item?.type || 'experience'}
                      onValueChange={(value) => {
                        setValue(`experienceProjects.${index}.type`, value);
                        // Clear type-specific fields when switching
                        if (value === 'experience') {
                          setValue(`experienceProjects.${index}.company`, '');
                          setValue(`experienceProjects.${index}.position`, '');
                          setValue(`experienceProjects.${index}.startDate`, '');
                          setValue(`experienceProjects.${index}.endDate`, '');
                          setValue(`experienceProjects.${index}.current`, false);
                        } else {
                          setValue(`experienceProjects.${index}.name`, '');
                          setValue(`experienceProjects.${index}.url`, '');
                          setValue(`experienceProjects.${index}.technologies`, []);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="experience">
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            {t('work_experience_option')}
                          </div>
                        </SelectItem>
                        <SelectItem value="project">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4" />
                            {t('project_option')}
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Experience-specific fields */}
                  {item?.type === 'experience' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`company-${index}`}>{t('exp_company')} *</Label>
                          <Input
                            id={`company-${index}`}
                            {...register(`experienceProjects.${index}.company`)}
                            placeholder={t('exp_company_placeholder')}
                            data-testid={`field-experienceProjects-${index}-company`}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`position-${index}`}>{t('exp_position')} *</Label>
                          <Input
                            id={`position-${index}`}
                            {...register(`experienceProjects.${index}.position`)}
                            placeholder={t('exp_position_placeholder')}
                            data-testid={`field-experienceProjects-${index}-position`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`startDate-${index}`}>{t('exp_start_date')} *</Label>
                          <Input
                            id={`startDate-${index}`}
                            type="month"
                            {...register(`experienceProjects.${index}.startDate`)}
                            placeholder={t('exp_start_placeholder')}
                            data-testid={`field-experienceProjects-${index}-startDate`}
                          />
                          <p className="text-xs text-muted-foreground mt-1">{t('date_format_hint')}</p>
                        </div>
                        <div>
                          {!watch(`experienceProjects.${index}.current`) && (
                            <>
                              <Label htmlFor={`endDate-${index}`}>{t('exp_end_date')}</Label>
                              <Input
                                id={`endDate-${index}`}
                                type="month"
                                {...register(`experienceProjects.${index}.endDate`, {
                                  onBlur: () => {
                                    try {
                                      const s = (watch(`experienceProjects.${index}.startDate`) || '').toString();
                                      const e = (watch(`experienceProjects.${index}.endDate`) || '').toString();
                                      if (s && e && s > e) {
                                        setError(`experienceProjects.${index}.endDate` as any, { type: 'validate', message: t('date_range_invalid') });
                                      } else {
                                        clearErrors(`experienceProjects.${index}.endDate` as any);
                                      }
                                    } catch {}
                                  }
                                })}
                                placeholder={t('exp_end_placeholder')}
                                data-testid={`field-experienceProjects-${index}-endDate`}
                              />
                              {((errors as any)?.experienceProjects?.[index]?.endDate) && (
                                <p className="text-sm text-destructive mt-1">{String((errors as any).experienceProjects?.[index]?.endDate?.message || '')}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">{t('date_format_hint')}</p>
                            </>
                          )}
                          <div className="flex items-center mt-2">
                            <input
                              id={`current-${index}`}
                              type="checkbox"
                              {...register(`experienceProjects.${index}.current`, {
                                onChange: (e) => {
                                  const checked = (e.target as HTMLInputElement).checked;
                                  setValue(`experienceProjects.${index}.endDate`, checked ? 'Present' : '');
                                },
                              })}
                              className="ltr:mr-2 rtl:ml-2"
                              data-testid={`field-experienceProjects-${index}-current`}
                            />
                            <Label htmlFor={`current-${index}`} className="text-sm">{t('exp_current')}</Label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Project-specific fields */}
                  {item?.type === 'project' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`name-${index}`}>{t('proj_name')} *</Label>
                          <Input
                            id={`name-${index}`}
                            {...register(`experienceProjects.${index}.name`)}
                            placeholder={t('proj_name_placeholder')}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`url-${index}`}>{t('proj_url')}</Label>
                          <Input
                            id={`url-${index}`}
                            {...register(`experienceProjects.${index}.url`)}
                            placeholder={t('proj_url_placeholder')}
                          />
                        </div>
                      </div>

                      <div>
                        <Label>{t('proj_technologies')}</Label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {watch(`experienceProjects.${index}.technologies`)?.map((tech: string, techIndex: number) => (
                            <span
                              key={techIndex}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground/90"
                            >
                              {tech}
                              <button
                                type="button"
                                onClick={() => removeTechnology(index, techIndex)}
                                className="ltr:ml-1 rtl:mr-1 text-muted-foreground hover:text-foreground"
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
                            placeholder={t('proj_add_tech_placeholder')}
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

                      {/* Project timeline */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`proj-startDate-${index}`}>{t('exp_start_date')}</Label>
                          <Input
                            id={`proj-startDate-${index}`}
                            type="month"
                            {...register(`experienceProjects.${index}.startDate`)}
                            placeholder={t('exp_start_placeholder')}
                          />
                          <p className="text-xs text-muted-foreground mt-1">{t('date_format_hint')}</p>
                        </div>
                        <div>
                          {!watch(`experienceProjects.${index}.current`) && (
                            <>
                              <Label htmlFor={`proj-endDate-${index}`}>{t('exp_end_date')}</Label>
                              <Input
                                id={`proj-endDate-${index}`}
                                type="month"
                                {...register(`experienceProjects.${index}.endDate`, {
                                  onBlur: () => {
                                    try {
                                      const s = (watch(`experienceProjects.${index}.startDate`) || '').toString();
                                      const e = (watch(`experienceProjects.${index}.endDate`) || '').toString();
                                      if (s && e && s > e) {
                                        setError(`experienceProjects.${index}.endDate` as any, { type: 'validate', message: t('date_range_invalid') });
                                      } else {
                                        clearErrors(`experienceProjects.${index}.endDate` as any);
                                      }
                                    } catch {}
                                  }
                                })}
                                placeholder={t('exp_end_placeholder')}
                              />
                              {((errors as any)?.experienceProjects?.[index]?.endDate) && (
                                <p className="text-sm text-destructive mt-1">{String((errors as any).experienceProjects?.[index]?.endDate?.message || '')}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">{t('date_format_hint')}</p>
                            </>
                          )}
                          <div className="flex items-center mt-2">
                            <input
                              id={`proj-current-${index}`}
                              type="checkbox"
                              {...register(`experienceProjects.${index}.current`, {
                                onChange: (e) => {
                                  const checked = (e.target as HTMLInputElement).checked;
                                  setValue(`experienceProjects.${index}.endDate`, checked ? 'Present' : '');
                                },
                              })}
                              className="ltr:mr-2 rtl:ml-2"
                              data-testid={`field-experienceProjects-${index}-current-project`}
                            />
                            <Label htmlFor={`proj-current-${index}`} className="text-sm">{t('proj_current')}</Label>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Common fields */}
                  <div>
                    <Label htmlFor={`description-${index}`}>
                      {item?.type === 'experience' ? t('exp_raw_description') : t('proj_description')} *
                    </Label>
                    <Textarea
                      id={`description-${index}`}
                      {...register(`experienceProjects.${index}.description`)}
                      placeholder={item?.type === 'experience' ? t('exp_description_placeholder') : t('proj_description_placeholder')}
                      rows={3}
                      data-testid={`field-experienceProjects-${index}-description`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => generateBullets(index)}
                      disabled={loadingAI === index || disabledButtons.has(index)}
                      className="mt-2"
                      aria-label={loadingAI === index ? t('exp_generating') : t('exp_generate_bullets')}
                    >
                      <Wand2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {loadingAI === index ? t('exp_generating') : disabledButtons.has(index) ? t('ai_wait_message') : t('exp_generate_bullets')}
                    </Button>
                  </div>

                  {/* Generated bullets */}
                  {watch(`experienceProjects.${index}.bullets`)?.length > 0 && (
                    <div>
                      <Label>{item?.type === 'experience' ? t('exp_generated_bullets') : t('proj_generated_bullets')}</Label>
                      <div className="space-y-2 mt-2">
                        {watch(`experienceProjects.${index}.bullets`).map((bullet: string, bulletIndex: number) => (
                          <div key={bulletIndex} className="flex items-start space-x-2">
                            <span className="text-sm text-muted-foreground mt-1">•</span>
                            <Input
                              value={bullet}
                              onChange={(e) => {
                                const bullets = watch(`experienceProjects.${index}.bullets`);
                                bullets[bulletIndex] = e.target.value;
                                setValue(`experienceProjects.${index}.bullets`, bullets);
                              }}
                              className="flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={addExperience} className="w-full">
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('exp_add_experience')}
        </Button>
        <Button type="button" variant="outline" onClick={addProject} className="w-full">
          <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('proj_add_project')}
        </Button>
      </div>
    </div>
  );
}
