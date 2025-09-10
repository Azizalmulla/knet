'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';

// Error budget monitoring
const ERROR_BUDGET = {
  uploadErrors: 0,
  aiRetries: 0,
  windowStart: Date.now(),
  WINDOW_SIZE: 5 * 60 * 1000, // 5 minutes
  MAX_UPLOAD_ERRORS: 10,
  MAX_AI_RETRIES: 15
};

const incrementErrorBudget = (type: 'upload' | 'ai') => {
  const now = Date.now();
  
  // Reset window if needed
  if (now - ERROR_BUDGET.windowStart > ERROR_BUDGET.WINDOW_SIZE) {
    ERROR_BUDGET.uploadErrors = 0;
    ERROR_BUDGET.aiRetries = 0;
    ERROR_BUDGET.windowStart = now;
  }
  
  if (type === 'upload') {
    ERROR_BUDGET.uploadErrors++;
    if (ERROR_BUDGET.uploadErrors > ERROR_BUDGET.MAX_UPLOAD_ERRORS) {
      console.error('ALERT:UPLOAD_ERRORS', { 
        count: ERROR_BUDGET.uploadErrors, 
        window: ERROR_BUDGET.WINDOW_SIZE / 1000 / 60 + 'min' 
      });
    }
  } else if (type === 'ai') {
    ERROR_BUDGET.aiRetries++;
    if (ERROR_BUDGET.aiRetries > ERROR_BUDGET.MAX_AI_RETRIES) {
      console.error('ALERT:AI_RETRIES', { 
        count: ERROR_BUDGET.aiRetries, 
        window: ERROR_BUDGET.WINDOW_SIZE / 1000 / 60 + 'min' 
      });
    }
  }
};
import { getFields, getAreasForField, matchSuggestedVacancies } from '@/lib/career-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/language';

const getUploadSchema = (t: (key: string) => string) => z.object({
  fullName: z.string().min(1, t('required')),
  email: z.string().email(t('invalid_email')),
  phone: z.string().min(1, t('required')),
  fieldOfStudy: z.string().min(1, t('required')),
  areaOfInterest: z.string().min(1, t('required')),
  cv: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, t('cv_required'))
    .refine((files) => files[0]?.type === 'application/pdf', t('pdf_only')),
});

type UploadFormData = z.infer<ReturnType<typeof getUploadSchema>>;

export default function UploadCVForm() {
  const { t } = useLanguage();
  const schema = useMemo(() => getUploadSchema(t), [t]);
  const [vacancies, setVacancies] = useState<string[]>([]);
  const [suggestedVacancies, setSuggestedVacancies] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showInvalidComboToast, setShowInvalidComboToast] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<UploadFormData>({
    resolver: zodResolver(schema),
  });

  const fieldOfStudy = watch('fieldOfStudy');
  const areaOfInterest = watch('areaOfInterest');

  // Telemetry management
  const telemetryQueue = useRef<any[]>([]);
  const telemetryTimeout = useRef<NodeJS.Timeout | null>(null);
  const activeTelemetryRequests = useRef<Set<Promise<any>>>(new Set());
  const maxConcurrentRequests = 3;

  const sendTelemetryBatch = useCallback(async (batch: any[]) => {
    if (activeTelemetryRequests.current.size >= maxConcurrentRequests) {
      // Wait for a request to complete before sending
      await Promise.race(Array.from(activeTelemetryRequests.current));
    }

    const request = fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    }).catch(() => {}).finally(() => {
      activeTelemetryRequests.current.delete(request);
    });

    activeTelemetryRequests.current.add(request);
    return request;
  }, []);

  const debouncedTelemetry = useCallback((data: any) => {
    telemetryQueue.current.push(data);
    
    if (telemetryTimeout.current) {
      clearTimeout(telemetryTimeout.current);
    }
    
    telemetryTimeout.current = setTimeout(() => {
      if (telemetryQueue.current.length > 0) {
        sendTelemetryBatch([...telemetryQueue.current]);
        telemetryQueue.current = [];
      }
    }, 2000); // 2 second debounce
  }, [sendTelemetryBatch]);

  // Cleanup pending telemetry timeout on unmount
  useEffect(() => {
    return () => {
      if (telemetryTimeout.current) {
        clearTimeout(telemetryTimeout.current);
        telemetryTimeout.current = null;
      }
    };
  }, []);

  // Recompute suggestions when selection changes
  useEffect(() => {
    if (fieldOfStudy && areaOfInterest) {
      const match = matchSuggestedVacancies(fieldOfStudy, areaOfInterest);
      if (match) {
        setSuggestedVacancies(match);
        setVacancies(match.split('/'));
        setShowInvalidComboToast(false);
        // Debounced telemetry tracking
        debouncedTelemetry({ field: fieldOfStudy, area: areaOfInterest, action: 'selection' });
      } else {
        setSuggestedVacancies(null);
        setVacancies([]);
        if (!showInvalidComboToast) {
          toast.error(t('invalid_combo'));
          setShowInvalidComboToast(true);
        }
      }
    } else {
      setSuggestedVacancies(null);
      setVacancies([]);
      setShowInvalidComboToast(false);
    }
  }, [fieldOfStudy, areaOfInterest, showInvalidComboToast]);

  const isSubmitDisabled = isSubmitting || !fieldOfStudy || !areaOfInterest || !suggestedVacancies;

  const onSubmit = async (data: UploadFormData) => {
    if (!suggestedVacancies) {
      toast.error('Please select both Field of Study and Area of Interest with valid suggested vacancies.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload CV to blob
      const formData = new FormData();
      formData.append('file', data.cv[0]);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) {
        incrementErrorBudget('upload');
        throw new Error('Upload failed');
      }
      const { url } = await uploadRes.json();

      // Insert to DB
      const submitRes = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          fieldOfStudy: data.fieldOfStudy,
          areaOfInterest: data.areaOfInterest,
          suggestedVacancies: suggestedVacancies || matchSuggestedVacancies(data.fieldOfStudy, data.areaOfInterest),
          cvUrl: url,
          cvType: 'uploaded',
        }),
      });
      if (!submitRes.ok) {
        throw new Error('Submission failed');
      }

      // Keep UI list populated after submission
      const match = suggestedVacancies || matchSuggestedVacancies(fieldOfStudy, areaOfInterest);
      setSuggestedVacancies(match || null);
      setVacancies(match ? match.split('/') : []);

      setIsSuccess(true);
    } catch (error) {
      console.error('Submission error:', error);
      alert('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">{t('success_title')}</h2>
          <p className="text-gray-600 mb-6">{t('success_subtitle')}</p>
          
          {vacancies.length > 0 && (
            <div className="text-left">
              <h3 className="font-semibold mb-3">{t('suggested_vacancies_title')}:</h3>
              <ul className="space-y-2">
                {vacancies.map(vacancy => (
                  <li key={vacancy} className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                    {vacancy}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <Button asChild className="mt-6">
            <a href="/start">{t('back_to_dashboard')}</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t('upload_title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fullName">{t('label_full_name')} *</Label>
              <Input
                id="fullName"
                {...register('fullName')}
                placeholder={t('placeholder_full_name')}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500 mt-1">{errors.fullName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="email">{t('label_email')} *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder={t('placeholder_email')}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="phone">{t('label_phone')} *</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder={t('placeholder_phone')}
              defaultValue="+965 "
            />
            {errors.phone && (
              <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fieldOfStudy">{t('label_field_of_study')} *</Label>
              <Select onValueChange={(value: string) => setValue('fieldOfStudy', value)}>
                <SelectTrigger id="fieldOfStudy" aria-label="Field of Study" data-testid="trigger-fieldOfStudy">
                  <SelectValue placeholder={t('placeholder_select_field')} />
                </SelectTrigger>
                <SelectContent>
                  {getFields().map(field => (
                    <SelectItem key={field} value={field}>{field}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.fieldOfStudy && (
                <p className="text-sm text-red-500 mt-1">{errors.fieldOfStudy.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="areaOfInterest">{t('label_area_of_interest')} *</Label>
              <Select 
                onValueChange={(value: string) => setValue('areaOfInterest', value)}
                disabled={!fieldOfStudy}
              >
                <SelectTrigger id="areaOfInterest" aria-label="Area of Interest" data-testid="trigger-areaOfInterest">
                  <SelectValue placeholder={t('placeholder_select_interest')} />
                </SelectTrigger>
                <SelectContent>
                  {fieldOfStudy && getAreasForField(fieldOfStudy).map(area => (
                    <SelectItem key={area} value={area}>{area}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.areaOfInterest && (
                <p className="text-sm text-red-500 mt-1">{errors.areaOfInterest.message}</p>
              )}
            </div>
          </div>

          {suggestedVacancies && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4">
              <h4 className="font-medium mb-2">{t('suggested_vacancies_title')}</h4>
              <ul className="list-disc pl-5 space-y-1">
                {suggestedVacancies.split('/').map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Label htmlFor="cv">{t('label_cv_upload')} *</Label>
            <Input
              id="cv"
              type="file"
              accept=".pdf"
              {...register('cv')}
              className="cursor-pointer"
            />
            {errors.cv && (
              <p className="text-sm text-red-500 mt-1">{errors.cv.message}</p>
            )}
          </div>

          {/* Privacy Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm">
            <h4 className="font-medium text-blue-900 mb-2">{t('privacy_notice_upload_title')}</h4>
            <p className="text-blue-800 mb-2">
              {t('privacy_notice_upload_p1')}
            </p>
            <p className="text-blue-700">
              {t('privacy_notice_upload_p2')}
              {/* Contact support for privacy inquiries */}
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? t('uploading') : isSubmitDisabled && !isSubmitting ? t('complete_all_fields') : t('submit_cv')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
