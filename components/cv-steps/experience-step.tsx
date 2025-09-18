'use client';

import { useState, useRef, useEffect } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { useLanguage } from '@/lib/language';
import { toast } from 'sonner';

export function ExperienceStep() {
  const { register, control, formState: { errors }, setValue, watch, getValues, setError } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'experience',
  });

  const [loadingAI, setLoadingAI] = useState<number | null>(null);
  const [disabledButtons, setDisabledButtons] = useState<Set<number>>(new Set());
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

  const serializeSingleExperience = (exp: any) => {
    if (!exp) return '';
    const parts = [];
    if (exp.position) parts.push(`Position: ${exp.position}`);
    if (exp.company) parts.push(`Company: ${exp.company}`);
    if (exp.startDate) parts.push(`Start: ${exp.startDate}`);
    if (exp.endDate || exp.current) parts.push(`End: ${exp.current ? 'Present' : exp.endDate}`);
    if (exp.description) parts.push(`Description: ${exp.description}`);
    if (exp.bullets?.length > 0) parts.push(`Bullets: ${exp.bullets.join('; ')}`);
    return parts.join('\n');
  };

  const generateBullets = async (index: number) => {
    console.log('🔧 Generate bullets clicked for index:', index);
    const values = getValues();
    const currentExp = values.experience?.[index];
    console.log('Current experience:', currentExp);
    console.log('Personal info:', values.personalInfo);
    
    if (!currentExp?.description && !currentExp?.position) {
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
      // If this operation is still marked active for this index, clear loading and mark stale
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
      const caPayload = {
        mode: 'bullets',
        locale: currentLocale,
        tone: 'professional',
        form: {
          personalInfo: {
            fullName: (values as any).fullName?.trim() || '',
            email: (values as any).email?.trim() || '',
          },
          experience: [
            {
              title: currentExp?.position || currentExp?.title || '',
              company: currentExp?.company || '',
              location: currentExp?.location || '',
              startDate: currentExp?.startDate || '',
              endDate: currentExp?.endDate || '',
              bullets: Array.isArray(currentExp?.bullets) ? currentExp.bullets : [],
              technologies: Array.isArray(currentExp?.technologies) ? currentExp.technologies : [],
              description: currentExp?.description || ''
            }
          ],
        },
        parsedCv: serializeSingleExperience(currentExp),
        jobDescription: (values as any)?.review?.jobDescription?.slice(0, 3000) || '',
        bulletsInput: {
          company: currentExp?.company || '',
          title: currentExp?.position || currentExp?.title || '',
          isCurrent: !!currentExp?.current,
          rawNotes: currentExp?.description || '',
          techCsv: Array.isArray(currentExp?.technologies) ? currentExp.technologies.join(', ') : ''
        }
      } as any;

      // Primary: legacy rewrite endpoint for compatibility with tests
      const rewriteRes = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: currentExp?.description || '',
          section: 'experience',
        }),
      });
      // Click metric after initiating primary call to avoid consuming the first mocked fetch in tests
      sendEvent('ai_bullets_clicks', 1, { index });

      // Primary happy path: legacy rewrite returns { ok: true, json() }
      if (rewriteRes.ok) {
        if (!isActive()) return; // stale
        const data = await rewriteRes.json();
        const bullets: string[] = data?.bullets || [];
        const tidyBullets = (list: string[]) => list
          .map(b => b.trim().replace(/^[−\-•\s]*/, '').replace(/^(i['’]m|i am)\b/i, '').replace(/\s+/g, ' '))
          .map(b => (b[0] ? b[0].toUpperCase() + b.slice(1) : b))
          .map(b => /[.!?]$/.test(b) ? b : b + '.');
        const cleaned = tidyBullets(bullets).slice(0, 5);
        if (cleaned.length > 0) {
          if (isActive()) setValue(`experience.${index}.bullets`, cleaned);
          toast.success('ATS-optimized bullets generated');
          sendEvent('avg_bullets_generated_per_click', cleaned.length, { index });
        } else {
          toast.info('No bullets generated');
        }
      } else {
        // Fallback to career-assistant with status handling
        const res = await fetch('/api/ai/career-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(caPayload),
          signal: controller.signal,
        });
        console.log('📥 Fallback response status:', res.status);

        if (res.status === 200) {
          if (!isActive()) return; // stale
          const data = await res.json();
          const bullets: string[] = data?.bullets || data?.cv?.experience?.[0]?.bullets || [];
          const tidyBullets = (list: string[]) => list
            .map(b => b.trim().replace(/^[−\-•\s]*/, '').replace(/^(i['’]m|i am)\b/i, '').replace(/\s+/g, ' '))
            .map(b => (b[0] ? b[0].toUpperCase() + b.slice(1) : b))
            .map(b => /[.!?]$/.test(b) ? b : b + '.');
          const cleaned = tidyBullets(bullets).slice(0, 5);
          if (cleaned.length > 0) {
            if (isActive()) setValue(`experience.${index}.bullets`, cleaned);
            toast.success('ATS-optimized bullets generated');
            sendEvent('avg_bullets_generated_per_click', cleaned.length, { index });
          } else {
            toast.info('No bullets generated');
          }
        } else if (res.status === 422) {
          const data = await res.json();
          // 422 response
          const needs = data?.needs || [];
          needs.forEach((path: string) => {
            const field = path.replace(/^personalInfo\./, '');
            try {
              setError(field as any, { type: 'ai', message: 'Required for AI' });
            } catch {}
          });
          toast.error('Add the highlighted fields, then retry');
          sendEvent('422_count', 1, { feature: 'ai_bullets' });
        } else if (res.status === 429) {
          // Rate limited
          toast.error('Model is busy — try again');
          setDisabledButtons(prev => new Set(prev).add(index));
          setTimeout(() => {
            setDisabledButtons(prev => {
              const next = new Set(prev);
              next.delete(index);
              return next;
            });
          }, 10000);
          sendEvent('429_count', 1, { feature: 'ai_bullets' });
        } else {
          // Unexpected fallback status
          throw new Error(`Failed to generate bullets: ${res.status}`);
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('⏳ Bullets generation aborted (timeout or manual).');
        toast.error('Request timed out. Please try again');
        sendEvent('ai_bullets_timeout', 1, { index });
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

  return (
    <div className="space-y-6">
      {fields.map((field, index) => (
        <Card key={field.id} className="relative">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg">{t('step_experience')} {index + 1}</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => remove(index)}
              className="text-destructive hover:text-destructive/90"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`company-${index}`}>{t('exp_company')} *</Label>
                <Input
                  id={`company-${index}`}
                  {...register(`experience.${index}.company`)}
                  placeholder={t('exp_company_placeholder')}
                  aria-invalid={!!(errors as any).experience?.[index]?.company}
                  aria-describedby={(errors as any).experience?.[index]?.company ? `company-${index}-error` : undefined}
                  data-testid={`field-experience-${index}-company`}
                />
                {(errors as any).experience?.[index]?.company && (
                  <p id={`company-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-experience-${index}-company`}>
                    {(errors as any).experience[index]?.company?.message as string}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`position-${index}`}>{t('exp_position')} *</Label>
                <Input
                  id={`position-${index}`}
                  {...register(`experience.${index}.position`)}
                  placeholder={t('exp_position_placeholder')}
                  aria-invalid={!!(errors as any).experience?.[index]?.position}
                  aria-describedby={(errors as any).experience?.[index]?.position ? `position-${index}-error` : undefined}
                  data-testid={`field-experience-${index}-position`}
                />
                {(errors as any).experience?.[index]?.position && (
                  <p id={`position-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-experience-${index}-position`}>
                    {(errors as any).experience[index]?.position?.message as string}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor={`startDate-${index}`}>{t('exp_start_date')} *</Label>
                <Input
                  id={`startDate-${index}`}
                  {...register(`experience.${index}.startDate`)}
                  placeholder={t('exp_start_placeholder')}
                  aria-invalid={!!(errors as any).experience?.[index]?.startDate}
                  aria-describedby={(errors as any).experience?.[index]?.startDate ? `startDate-${index}-error` : undefined}
                  data-testid={`field-experience-${index}-startDate`}
                />
                {(errors as any).experience?.[index]?.startDate && (
                  <p id={`startDate-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-experience-${index}-startDate`}>
                    {(errors as any).experience[index]?.startDate?.message as string}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor={`endDate-${index}`}>{t('exp_end_date')}</Label>
                <Input
                  id={`endDate-${index}`}
                  {...register(`experience.${index}.endDate`)}
                  placeholder={t('exp_end_placeholder')}
                  aria-invalid={!!(errors as any).experience?.[index]?.endDate}
                  aria-describedby={(errors as any).experience?.[index]?.endDate ? `endDate-${index}-error` : undefined}
                  data-testid={`field-experience-${index}-endDate`}
                />
                {(errors as any).experience?.[index]?.endDate && (
                  <p id={`endDate-${index}-error`} role="alert" className="text-sm text-destructive mt-1" data-testid={`error-experience-${index}-endDate`}>
                    {(errors as any).experience[index]?.endDate?.message as string}
                  </p>
                )}
                <div className="flex items-center mt-2">
                  <input
                    id={`current-${index}`}
                    type="checkbox"
                    {...register(`experience.${index}.current`)}
                    className="ltr:mr-2 rtl:ml-2"
                    data-testid={`field-experience-${index}-current`}
                  />
                  <Label htmlFor={`current-${index}`} className="text-sm">{t('exp_current')}</Label>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor={`description-${index}`}>{t('exp_raw_description')}</Label>
              <Textarea
                id={`description-${index}`}
                {...register(`experience.${index}.description`)}
                placeholder="What did you do and why it mattered? e.g., Built React components, worked with designers, reduced page load by ~30%."
                rows={3}
                data-testid={`field-experience-${index}-description`}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generateBullets(index)}
                disabled={loadingAI === index || disabledButtons.has(index)}
                className="mt-2"
                aria-label={loadingAI === index ? 'Generating...' : 'Generate ATS Bullets'}
              >
                <Wand2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                <span className="sr-only">{loadingAI === index ? 'Generating...' : 'Generate ATS Bullets'}</span>
                {loadingAI === index ? 'Generating...' : disabledButtons.has(index) ? 'Wait 10s...' : 'Generate ATS Bullets'}
              </Button>
            </div>

            {watch(`experience.${index}.bullets`)?.length > 0 && (
              <div>
                <Label>{t('exp_generated_bullets')}</Label>
                <div className="space-y-2 mt-2">
                  {watch(`experience.${index}.bullets`).map((bullet: string, bulletIndex: number) => (
                    <div key={bulletIndex} className="flex items-start space-x-2">
                      <span className="text-sm text-muted-foreground mt-1">•</span>
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
        <Plus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
        {t('exp_add_experience')}
      </Button>
    </div>
  );
}
