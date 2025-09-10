'use client';

import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/lib/language';

export function PersonalInfoStep() {
  const { register, trigger, formState: { errors } } = useFormContext();
  const { t } = useLanguage();

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
            <p id="fullName-error" role="alert" className="text-sm text-red-500 mt-1" data-testid="error-fullName">{errors.fullName.message as string}</p>
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
            <p id="email-error" role="alert" className="text-sm text-red-500 mt-1" data-testid="error-email">{errors.email.message as string}</p>
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
            <p id="phone-error" role="alert" className="text-sm text-red-500 mt-1" data-testid="error-phone">{errors.phone.message as string}</p>
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
            <p id="location-error" role="alert" className="text-sm text-red-500 mt-1" data-testid="error-location">{errors.location.message as string}</p>
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
        <p className="text-xs text-zinc-500 mt-1">1–2 sentences about your goals. Keep it simple and professional.</p>
        {errors.summary && (
          <p id="summary-error" role="alert" className="text-sm text-red-500 mt-1" data-testid="error-summary">
            {String((errors as any).summary?.message || '')}
          </p>
        )}
      </div>
    </div>
  );
}
