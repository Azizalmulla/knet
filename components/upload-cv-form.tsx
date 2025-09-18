'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
// Using server-side multipart upload via /api/blob/upload

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
import { WatheeftiDegreeBuckets, WatheeftiYoEBuckets, WatheeftiAreas } from '@/lib/watheefti-taxonomy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/language';

// Simple client-side image compression
async function compressImage(file: File, targetMaxBytes = 2_000_000, maxDimension = 2000): Promise<File> {
  try {
    if (!file.type.startsWith('image/')) return file;
    const bytes = file.size;
    if (bytes <= targetMaxBytes) return file;

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });

    const { width, height } = img;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const qualities = [0.8, 0.7, 0.6, 0.5, 0.4];
    for (const q of qualities) {
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', q));
      if (!blob) continue;
      if (blob.size <= targetMaxBytes || q === qualities[qualities.length - 1]) {
        // If compressed bigger than original, keep original
        if (blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.(png|jpg|jpeg)$/i, '') + '-compressed.jpg', { type: 'image/jpeg' });
      }
    }
    return file;
  } catch {
    return file;
  }
}

const getUploadSchema = (t: (key: string) => string) => z.object({
  fullName: z.string().min(1, t('required')),
  email: z.string().email(t('invalid_email')),
  phone: z.string().min(1, t('required')),
  fieldOfStudy: z.string().min(1, t('required')),
  areaOfInterest: z.string().min(1, t('required')),
  // Watheefti taxonomy fields (required, no free text)
  knetDegree: z.enum(WatheeftiDegreeBuckets),
  knetYoE: z.enum(WatheeftiYoEBuckets),
  knetArea: z.enum(WatheeftiAreas),
  gpa: z.preprocess((val) => {
    if (val === '' || val == null) return undefined;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return isFinite(n) ? n : undefined;
  }, z.number().min(0, t('gpa_min') || 'GPA must be at least 0.00').max(4, t('gpa_max') || 'GPA must be at most 4.00').optional()),
  cv: z
    .instanceof(FileList)
    .refine((files) => files.length > 0, t('cv_required'))
    .refine((files) => {
      const type = files[0]?.type || '';
      const allowed = new Set([
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/jpg',
      ]);
      return allowed.has(type);
    }, t('allowed_file_types')),
});

// IMPORTANT: react-hook-form's resolver expects the INPUT shape of the schema, not the transformed/output shape.
// Because we use z.preprocess for `gpa`, the input can be string | number | undefined.
// Using z.input<> here aligns the generics so the resolver type matches RHF's expectations.
type UploadFormData = z.input<ReturnType<typeof getUploadSchema>>;

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
  const knetDegree = watch('knetDegree');
  const knetYoE = watch('knetYoE');
  const knetArea = watch('knetArea');

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
      // Prepare file (with client-side compression for images) and upload via server endpoint (multipart)
      let file = data.cv[0];
      if (file.type.startsWith('image/')) {
        file = await compressImage(file, 2_000_000, 2000); // ~2MB target
      }
      const form = new FormData();
      form.append('file', file, file.name);
      const uploadRes = await fetch('/api/blob/upload', {
        method: 'POST',
        body: form,
      });
      const uploadJson: any = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadJson?.ok || !uploadJson?.url) {
        throw new Error(uploadJson?.error || 'Upload failed');
      }
      const url = uploadJson.url as string;

      // Insert to DB
      const payload: any = {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        fieldOfStudy: data.fieldOfStudy,
        areaOfInterest: data.areaOfInterest,
        suggestedVacancies: suggestedVacancies || matchSuggestedVacancies(data.fieldOfStudy, data.areaOfInterest),
        cvUrl: url,
        cvType: 'uploaded',
      }
      if (typeof data.gpa === 'number' && isFinite(data.gpa)) {
        payload.gpa = Number(data.gpa.toFixed(2))
      }
      if (data.knetYoE) {
        payload.yearsOfExperience = data.knetYoE
      }
      if (data.knetDegree && data.knetYoE && data.knetArea) {
        payload.knetProfile = {
          degreeBucket: data.knetDegree,
          yearsOfExperienceBucket: data.knetYoE,
          areaOfInterest: data.knetArea,
        }
      }

      const submitRes = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
          <p className="text-muted-foreground mb-6">{t('success_subtitle')}</p>
          
          {vacancies.length > 0 && (
            <div className="text-left">
              <h3 className="font-semibold mb-3">{t('suggested_vacancies_title')}:</h3>
              <ul className="space-y-2">
                {vacancies.map(vacancy => (
                  <li key={vacancy} className="flex items-center">
                    <span className="w-2 h-2 bg-primary rounded-full ltr:mr-3 rtl:ml-3"></span>
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
                <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>
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
                <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
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
              <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
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
                <p className="text-sm text-destructive mt-1">{errors.fieldOfStudy.message}</p>
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
                <p className="text-sm text-destructive mt-1">{errors.areaOfInterest.message}</p>
              )}
            </div>
          </div>

          {/* Experience and GPA */}
          {/* Watheefti Taxonomy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="knetDegree">Degree (Watheefti)</Label>
              <Select onValueChange={(value: string) => setValue('knetDegree', value as any)}>
                <SelectTrigger id="knetDegree" aria-label="Degree (Watheefti)">
                  <SelectValue placeholder="Select degree" />
                </SelectTrigger>
                <SelectContent>
                  {WatheeftiDegreeBuckets.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors as any && (errors as any).knetDegree && (
                <p className="text-sm text-destructive mt-1">{(errors as any).knetDegree.message as any}</p>
              )}
            </div>
            <div>
              <Label htmlFor="knetYoE">Years of Experience (Watheefti)</Label>
              <Select onValueChange={(value: string) => setValue('knetYoE', value as any)}>
                <SelectTrigger id="knetYoE" aria-label="Years of Experience (Watheefti)">
                  <SelectValue placeholder="Select years of experience" />
                </SelectTrigger>
                <SelectContent>
                  {WatheeftiYoEBuckets.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors as any && (errors as any).knetYoE && (
                <p className="text-sm text-destructive mt-1">{(errors as any).knetYoE.message as any}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="knetArea">Area of Interest (Watheefti)</Label>
            <Select onValueChange={(value: string) => setValue('knetArea', value as any)}>
              <SelectTrigger id="knetArea" aria-label="Area of Interest (Watheefti)">
                <SelectValue placeholder="Select area of interest" />
              </SelectTrigger>
              <SelectContent>
                {WatheeftiAreas.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors as any && (errors as any).knetArea && (
              <p className="text-sm text-destructive mt-1">{(errors as any).knetArea.message as any}</p>
            )}
          </div>

          <div>
            <Label htmlFor="gpa">{t('label_gpa') || 'GPA'} <span className="text-xs text-muted-foreground">(0.00–4.00, optional)</span></Label>
            <Input
              id="gpa"
              type="number"
              step="0.01"
              min={0}
              max={4}
              inputMode="decimal"
              placeholder={t('placeholder_gpa') || 'e.g., 3.50'}
              {...register('gpa')}
            />
            {errors.gpa && (
              <p className="text-sm text-destructive mt-1">{String(errors.gpa.message)}</p>
            )}
          </div>

          {suggestedVacancies && (
            <div className="bg-muted/30 border rounded-md p-4">
              <h4 className="font-medium mb-2">{t('suggested_vacancies_title')}</h4>
              <ul className="list-disc ltr:pl-5 rtl:pr-5 space-y-1">
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
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              {...register('cv')}
              className="cursor-pointer"
            />
            {errors.cv && (
              <p className="text-sm text-destructive mt-1">{errors.cv.message}</p>
            )}
          </div>

          {/* Privacy Notice */}
          <Alert>
            <AlertTitle>{t('privacy_notice_upload_title')}</AlertTitle>
            <AlertDescription>
              <p>{t('privacy_notice_upload_p1')}</p>
              <p className="mt-2">{t('privacy_notice_upload_p2')}</p>
            </AlertDescription>
          </Alert>

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
