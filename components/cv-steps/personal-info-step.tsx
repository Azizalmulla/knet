
'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLanguage } from '@/lib/language';

export function PersonalInfoStep() {
  const form = useFormContext();
  const { register, trigger, setValue, getValues, setError, formState: { errors } } = form as any;
  const summaryValue: string = (form as any).watch?.('summary') || '';
  const { t } = useLanguage();

  // AI Summary state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [undoValue, setUndoValue] = useState<string | null>(null);
  const [aiLocale, setAiLocale] = useState<'en' | 'ar' | 'kw'>(() => {
    try {
      const v = getValues();
      const lang = (v?.review?.language || v?.language) as 'en' | 'ar' | undefined;
      return lang === 'ar' ? 'ar' : 'en';
    } catch { return 'en'; }
  });
  const [backoff, setBackoff] = useState(false);

  const sendEvent = (event: string, value?: number, meta?: any) => {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, value, meta }),
      }).catch(() => {});
    } catch {}
  };

  const wordCount = (() => {
    const m = (summaryValue || '').trim();
    if (!m) return 0;
    return m.split(/\s+/).filter(Boolean).length;
  })();

  const tidyText = (s: string) => {
    let out = (s || '').trim().replace(/\s+/g, ' ');
    if (out && !/[.!?]$/.test(out)) out += '.';
    return out;
  };

  const toggleArabic = () => {
    setAiLocale(prev => (prev === 'en' ? 'ar' : prev === 'ar' ? 'kw' : 'en'));
  };

  const improveSummary = async (variant?: 'shorter' | 'stronger' | 'more_keywords') => {
    setAiError(null);
    if (backoff || aiLoading) return;
    try {
      setAiLoading(true);
      sendEvent('summary_ai_click', 1, { variant: variant || 'default', locale: aiLocale });

      const v = getValues() as any;
      const payload = {
        mode: 'summary',
        locale: aiLocale,
        tone: 'professional',
        variant,
        form: {
          personalInfo: {
            fullName: v?.fullName || '',
            email: v?.email || '',
            summary: v?.summary || '',
          },
          education: Array.isArray(v?.education) ? v.education : [],
          skills: v?.skills || {},
        },
        jobDescription: v?.review?.jobDescription || '',
      };

      const res = await fetch('/api/ai/career-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const data = await res.json();
        const needs: string[] = data?.needs || [];
        needs.forEach((path: string) => {
          const field = path.replace(/^personalInfo\./, '');
          try { setError(field as any, { type: 'ai', message: 'Required for AI' }); } catch {}
        });
        setAiError('Add the highlighted fields, then retry.');
        sendEvent('summary_ai_422', 1);
        return;
      }
      if (res.status === 429) {
        setAiError('Model is busy. Try again in a moment.');
        setBackoff(true);
        setTimeout(() => setBackoff(false), 10000);
        sendEvent('summary_ai_429', 1);
        return;
      }
      if (!res.ok) {
        setAiError('Something went wrong. Please try again.');
        return;
      }

      const data = await res.json();
      const aiSummary = data?.cv?.personalInfo?.summary;
      if (typeof aiSummary === 'string' && aiSummary.trim().length > 0) {
        setUndoValue(summaryValue || '');
        setValue('summary' as any, tidyText(aiSummary), { shouldDirty: true, shouldValidate: true });
        sendEvent('summary_ai_success', 1, { variant: variant || 'default', locale: aiLocale, words: wordCount });
      }
    } catch (e) {
      setAiError('Something went wrong. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fullName">{t('label_full_name')} *</Label>
          <Input
            id="fullName"
            {...register('fullName')}
            placeholder={t('placeholder_full_name')}
            aria-invalid={!!errors.fullName ? 'true' : 'false'}
            aria-describedby={errors.fullName ? 'fullName-error' : undefined}
            data-testid="field-fullName"
            onBlur={() => { void trigger('fullName' as any) }}
          />
          {errors.fullName && (
            <p id="fullName-error" role="alert" className="text-sm text-destructive mt-1" data-testid="error-fullName">{errors.fullName.message as string}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email">{t('label_email')} *</Label>
          <Input
            id="email"
            type="email"
            {...register('email')}
            placeholder={t('placeholder_email')}
            aria-invalid={!!errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            data-testid="field-email"
            onBlur={() => { void trigger('email' as any) }}
          />
          {errors.email && (
            <p id="email-error" role="alert" className="text-sm text-destructive mt-1" data-testid="error-email">{errors.email.message as string}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="phone">{t('label_phone')} *</Label>
          <Input
            id="phone"
            {...register('phone')}
            placeholder="+965 5xxxxxxx"
            aria-invalid={!!errors.phone ? 'true' : 'false'}
            aria-describedby={errors.phone ? 'phone-error' : undefined}
            data-testid="field-phone"
            onBlur={() => { void trigger('phone' as any) }}
          />
          {errors.phone && (
            <p id="phone-error" role="alert" className="text-sm text-destructive mt-1" data-testid="error-phone">{errors.phone.message as string}</p>
          )}
        </div>
        <div>
          <Label htmlFor="location">{t('label_location')} *</Label>
          <Input
            id="location"
            {...register('location')}
            placeholder="Kuwait City, Kuwait"
            aria-invalid={!!errors.location ? 'true' : 'false'}
            aria-describedby={errors.location ? 'location-error' : undefined}
            data-testid="field-location"
            onBlur={() => { void trigger('location' as any) }}
          />
          {errors.location && (
            <p id="location-error" role="alert" className="text-sm text-destructive mt-1" data-testid="error-location">{errors.location.message as string}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="summary">{t('label_summary')}</Label>
        <Textarea
          id="summary"
          {...register('summary')}
          placeholder="Aspiring software engineer with strong problem-solving skills and passion for building user-friendly apps."
          rows={4}
          aria-invalid={!!errors.summary ? 'true' : 'false'}
          aria-describedby={errors.summary ? 'summary-error' : undefined}
          data-testid="field-summary"
        />
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => improveSummary()} disabled={aiLoading || backoff}>
              {aiLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" />
                  Improve with AI
                </>
              ) : (
                'Improve with AI'
              )}
            </Button>
            <Badge onClick={() => improveSummary('shorter')} className="cursor-pointer select-none" variant="secondary">Shorter</Badge>
            <Badge onClick={() => improveSummary('stronger')} className="cursor-pointer select-none" variant="secondary">Stronger</Badge>
            <Badge onClick={() => improveSummary('more_keywords')} className="cursor-pointer select-none" variant="secondary">More keywords</Badge>
            <Badge onClick={toggleArabic} className="cursor-pointer select-none" variant="secondary">Arabic{aiLocale !== 'en' ? ` (${aiLocale === 'ar' ? 'MSA' : 'AR-KW'})` : ''}</Badge>
            <Badge onClick={() => { if (undoValue !== null) { setValue('summary' as any, undoValue, { shouldDirty: true, shouldValidate: true }); setUndoValue(null); } }} className={`select-none ${undoValue === null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} variant="outline">Undo</Badge>
            <span className="text-xs text-muted-foreground ltr:ml-auto rtl:mr-auto">~{wordCount} words (target 35–60)</span>
          </div>
          <p className="text-xs text-muted-foreground">1–2 sentences about your goals. Keep it simple and professional.</p>
          {aiError && (
            <Alert className="border-destructive/40 text-destructive">
              <AlertDescription>{aiError}</AlertDescription>
            </Alert>
          )}
        </div>
        {errors.summary && (
          <p id="summary-error" role="alert" className="text-sm text-destructive mt-1" data-testid="error-summary">
            {String((errors as any).summary?.message || '')}
          </p>
        )}
      </div>
    </div>
  );
}
