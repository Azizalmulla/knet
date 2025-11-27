
'use client';

import { useState, useEffect } from 'react';
import type React from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/lib/language';
import { createClient } from '@/lib/supabase-client';

export function PersonalInfoStep() {
  const form = useFormContext();
  const { register, trigger, setValue, getValues, setError, formState: { errors } } = form as any;
  const summaryValue: string = (form as any).watch?.('summary') || '';
  const { t } = useLanguage();
  const supabase = createClient();

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

  // Prefill and lock email to the authenticated user
  // This ensures submissions use the signed-in email, matching server behavior
  // and avoiding dashboard visibility mismatches.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const em = (user?.email || '').toLowerCase().trim();
        if (mounted && em) {
          try { setValue('email', em, { shouldValidate: true }); } catch {}
        }
      } catch {}
    })();
    return () => { mounted = false };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const normalizeLink = (key: 'linkedin'|'github'|'portfolio', val: string) => {
    const v = (val || '').trim();
    if (!v) return '';
    const ensureHttps = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
    if (key === 'linkedin') {
      if (/linkedin\.com/i.test(v)) return ensureHttps(v);
      if (/^[a-z0-9._-]+$/i.test(v)) return `https://linkedin.com/in/${v}`;
      return ensureHttps(v);
    }
    if (key === 'github') {
      if (/github\.com/i.test(v)) return ensureHttps(v);
      if (/^[a-z0-9._-]+$/i.test(v)) return `https://github.com/${v}`;
      return ensureHttps(v);
    }
    // portfolio
    return ensureHttps(v);
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
            readOnly
            disabled
            className="bg-neutral-100 cursor-not-allowed"
            aria-invalid={!!errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            data-testid="field-email"
            onBlur={() => { void trigger('email' as any) }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            ✓ Locked to your account email
          </p>
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
            placeholder={t('placeholder_phone')}
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
            placeholder={t('placeholder_location')}
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

      {/* Headline / Professional Title */}
      <div>
        <Label htmlFor="headline">Professional Title (optional)</Label>
        <Input
          id="headline"
          {...register('headline')}
          placeholder="e.g., Software Engineer, Fresh Graduate, Marketing Specialist"
          data-testid="field-headline"
        />
        <p className="text-xs text-muted-foreground mt-1">
          A brief title that appears below your name (e.g., "Software Engineer" or "Computer Science Student")
        </p>
      </div>

      <div>
        <Label htmlFor="summary">{t('label_summary')}</Label>
        <Textarea
          id="summary"
          {...register('summary')}
          placeholder={t('placeholder_summary')}
          rows={4}
          aria-invalid={!!errors.summary ? 'true' : 'false'}
          aria-describedby={errors.summary ? 'summary-error' : undefined}
          data-testid="field-summary"
        />
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
            <Button 
              onClick={() => improveSummary()} 
              disabled={aiLoading || backoff}
              className="w-full sm:w-auto"
            >
              {aiLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2" />
                  Improving...
                </>
              ) : (
                'Improve with AI'
              )}
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge onClick={() => improveSummary('shorter')} className="cursor-pointer select-none text-xs" variant="secondary">Shorter</Badge>
              <Badge onClick={() => improveSummary('stronger')} className="cursor-pointer select-none text-xs" variant="secondary">Stronger</Badge>
              <Badge onClick={() => improveSummary('more_keywords')} className="cursor-pointer select-none text-xs" variant="secondary">Keywords</Badge>
              <Badge onClick={toggleArabic} className="cursor-pointer select-none text-xs" variant="secondary">عربي</Badge>
              <Badge onClick={() => { if (undoValue !== null) { setValue('summary' as any, undoValue, { shouldDirty: true, shouldValidate: true }); setUndoValue(null); } }} className={`select-none text-xs ${undoValue === null ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} variant="outline">Undo</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">Word count:</span>
            <div className="flex-1 max-w-xs">
              <Progress 
                value={Math.min((wordCount / 47.5) * 100, 100)} 
                className="h-2"
              />
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${
              wordCount < 35 ? 'text-yellow-600' : 
              wordCount > 60 ? 'text-orange-600' : 
              'text-green-600'
            }`}>
              {wordCount} / 35-60
            </span>
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

      {/* Optional Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="linkedin">LinkedIn (optional)</Label>
          <Input
            id="linkedin"
            {...register('links.linkedin', {
              onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                try {
                  const normalized = normalizeLink('linkedin', (e?.target as HTMLInputElement)?.value || '');
                  if (normalized) setValue('links.linkedin' as any, normalized, { shouldDirty: true });
                } catch {}
              },
            })}
            placeholder="https://linkedin.com/in/username"
          />
        </div>
        <div>
          <Label htmlFor="github">GitHub (optional)</Label>
          <Input
            id="github"
            {...register('links.github', {
              onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                try {
                  const normalized = normalizeLink('github', (e?.target as HTMLInputElement)?.value || '');
                  if (normalized) setValue('links.github' as any, normalized, { shouldDirty: true });
                } catch {}
              },
            })}
            placeholder="https://github.com/username"
          />
        </div>
        <div>
          <Label htmlFor="portfolio">Portfolio (optional)</Label>
          <Input
            id="portfolio"
            {...register('links.portfolio', {
              onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                try {
                  const normalized = normalizeLink('portfolio', (e?.target as HTMLInputElement)?.value || '');
                  if (normalized) setValue('links.portfolio' as any, normalized, { shouldDirty: true });
                } catch {}
              },
            })}
            placeholder="yourdomain.com or https://yourdomain.com"
          />
        </div>
      </div>
    </div>
  );
}
