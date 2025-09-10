'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CVData } from '@/lib/cv-schemas';
import { MinimalTemplate } from '@/components/cv-templates/minimal-template';
import { ModernTemplate } from '@/components/cv-templates/modern-template';
import { CreativeTemplate } from '@/components/cv-templates/creative-template';
import { Download, FileText } from 'lucide-react';
import { getFields, getAreasForField, matchSuggestedVacancies } from '@/lib/career-map';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/language';

export function ReviewStep() {
  const form = useFormContext<CVData>();
  const cvData = form.getValues();
  const [selectedTemplate, setSelectedTemplate] = useState<'minimal' | 'modern' | 'creative'>(cvData.template || 'minimal');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>(cvData.language || 'en');
  const [isExporting, setIsExporting] = useState(false);
  const [fieldOfStudy, setFieldOfStudy] = useState<string>('');
  const [areaOfInterest, setAreaOfInterest] = useState<string>('');
  const [suggestedVacancies, setSuggestedVacancies] = useState<string | null>(null);
  const [showInvalidComboToast, setShowInvalidComboToast] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const { t } = useLanguage();

  const sendEvent = (event: string, value?: number, meta?: any) => {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, value, meta }),
      }).catch(() => {});
    } catch {}
  };

  const renderTemplate = () => {
    const templateData = { ...cvData, template: selectedTemplate, language: selectedLanguage };
    
    switch (selectedTemplate) {
      case 'modern':
        return <ModernTemplate data={templateData} />;
      case 'creative':
        return <CreativeTemplate data={templateData} />;
      default:
        return <MinimalTemplate data={templateData} />;
    }
  };

  const exportToPDF = () => {
    window.print();
  };

  const exportToDOCX = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cvData, template: selectedTemplate, language: selectedLanguage }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cvData.fullName?.replace(/\s+/g, '_')}_CV.docx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const isSubmitDisabled = !fieldOfStudy || !areaOfInterest || !suggestedVacancies;

  const submitCV = async () => {
    if (!fieldOfStudy || !areaOfInterest) {
      toast.error(t('complete_field_selection'));
      return;
    }

    try {
      const v = form.getValues();
      const pv: any = (v as any).personalInfo || {};
      const vac = suggestedVacancies || matchSuggestedVacancies(fieldOfStudy, areaOfInterest) || '';
      const apiUrl = '/api/cv/submit';

      const payload = {
        // Server expects camelCase keys
        fullName: (v as any).fullName || pv.fullName || '',
        email: (v as any).email || pv.email || '',
        phone: (v as any).phone || pv.phone || '',
        location: (v as any).location || pv.location || '',
        fieldOfStudy: fieldOfStudy || (v as any).education?.[0]?.fieldOfStudy || '',
        areaOfInterest: areaOfInterest || (v as any)?.skills?.technical?.[0] || '',
        suggestedVacancies: vac,
        // Include full CV data for HTML render
        education: v.education || [],
        experience: v.experience || [],
        projects: v.projects || [],
        skills: v.skills || {},
        template: selectedTemplate,
        language: selectedLanguage,
      } as any;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 200) {
        toast.success('Submitted to KNET ');
        sendEvent('submit_to_knet_success', 1);
      } else if (response.status === 400 || response.status === 422) {
        const data = await response.json();
        toast.error(data.error || 'Invalid submission');
        sendEvent('submit_to_knet_fail', 1, { status: response.status });
      } else if (response.status === 500) {
        toast.error('Server error — try again later');
        sendEvent('submit_to_knet_fail', 1, { status: response.status });
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.error('Submission failed:', error);
      toast.error('Failed to submit. Please try again.');
      sendEvent('submit_to_knet_fail', 1, { error: String(error) });
    }
  };

  function deepMerge<T>(base: T, patch: Partial<T>): T {
    if (Array.isArray(base) || Array.isArray(patch as any)) return (patch as any) ?? (base as any);
    if (base && typeof base === 'object' && patch && typeof patch === 'object') {
      const out: any = { ...base };
      for (const k of Object.keys(patch)) {
        out[k] = deepMerge((base as any)[k], (patch as any)[k]);
      }
      return out;
    }
    return (patch as any) ?? (base as any);
  }

  const serializeAllSections = (v: any) => {
    const parts = [];
    if (v.personalInfo) {
      parts.push(`Name: ${v.personalInfo.fullName || ''}`);
      parts.push(`Email: ${v.personalInfo.email || ''}`);
      if (v.personalInfo.phone) parts.push(`Phone: ${v.personalInfo.phone}`);
    }
    if (v.education?.length > 0) {
      parts.push(`Education: ${v.education.map((e: any) => `${e.degree} at ${e.institution}`).join('; ')}`);
    }
    if (v.experience?.length > 0) {
      parts.push(`Experience: ${v.experience.map((e: any) => `${e.position} at ${e.company}`).join('; ')}`);
    }
    if (v.projects?.length > 0) {
      parts.push(`Projects: ${v.projects.map((p: any) => p.name).join('; ')}`);
    }
    if (v.skills) {
      const skillsList = [];
      if (v.skills.programmingLanguages?.length > 0) skillsList.push(...v.skills.programmingLanguages);
      if (v.skills.frameworksLibraries?.length > 0) skillsList.push(...v.skills.frameworksLibraries);
      if (skillsList.length > 0) parts.push(`Skills: ${skillsList.join(', ')}`);
    }
    return parts.join('\n');
  };

  // Use AI Assistant: call /api/ai/career-assistant and merge results into the form
  const useAIAssistant = async (mode: 'complete' | 'optimize') => {
    // Use AI clicked with mode
    try {
      setAiLoading(true);
      sendEvent(mode === 'complete' ? 'ai_complete_clicks' : 'ai_improve_clicks', 1);
      const v = form.getValues();
      const rv: any = v as any;
      const pv: any = rv.personalInfo || {};
      // Form values
      const payload = {
        mode: mode,
        locale: rv?.review?.language ?? (selectedLanguage === 'ar' ? 'ar' : 'en'),
        tone: rv?.review?.tone || 'professional',
        form: {
          personalInfo: { 
            fullName: (rv.fullName?.trim?.() || pv.fullName?.trim?.() || ''),
            email: (rv.email?.trim?.() || pv.email?.trim?.() || ''),
            phone: (rv.phone || pv.phone || ''),
            location: (rv.location || pv.location || ''),
            links: (rv.links || pv.links || {}),
            summary: (rv.summary || pv.summary || '')
          },
          education: (rv.education || []).map((e: any) => ({
            degree: e?.degree || '',
            institution: e?.institution || '',
            location: e?.location || '',
            startDate: e?.startDate || '',
            endDate: e?.endDate || e?.graduationDate || '',
            details: Array.isArray(e?.details) ? e.details : [],
          })),
          experience: (rv.experience || []).map((e: any) => ({
            title: e?.title || e?.position || '',
            company: e?.company || '',
            location: e?.location || '',
            startDate: e?.startDate || '',
            endDate: e?.endDate || '',
            bullets: Array.isArray(e?.bullets) ? e.bullets : [],
            technologies: Array.isArray(e?.technologies) ? e.technologies : [],
          })),
          projects: (rv.projects || []).map((p: any) => ({
            name: p?.name || '',
            description: p?.description || '',
            technologies: Array.isArray(p?.technologies) ? p.technologies : [],
            bullets: Array.isArray(p?.bullets) ? p.bullets : [],
            link: p?.url || p?.link || undefined,
          })),
          skills: (() => {
            const s: any = rv.skills || {}
            return {
              programmingLanguages: Array.isArray(s.technical) ? s.technical : undefined,
              frameworksLibraries: undefined,
              databases: undefined,
              toolsPlatforms: undefined,
              softSkills: Array.isArray(s.soft) ? s.soft : undefined,
              languages: Array.isArray(s.languages) ? s.languages : undefined,
            }
          })()
        },
        parsedCv: serializeAllSections(v).slice(0, 12000),
        jobDescription: ((rv.review?.jobDescription as string) || '').slice(0, 3000),
        fieldOfStudy: fieldOfStudy || rv.education?.[0]?.fieldOfStudy || '',
        areaOfInterest: areaOfInterest || (rv.skills?.technical?.[0] ?? '')
      };
      
      // Sending payload

      const res = await fetch('/api/ai/career-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      // Response status:

      if (res.status === 422) {
        const data = await res.json();
        // 422 response
        const needs: string[] = data?.needs || [];
        needs.forEach((path: string) => {
          const field = path.replace(/^personalInfo\./, '');
          try { 
            form.setError(field as any, { type: 'ai', message: 'Required for AI' });
          } catch {}
        });
        toast.error('Add the highlighted fields, then retry.');
        sendEvent('422_count', 1, { feature: mode === 'complete' ? 'ai_complete' : 'ai_improve' });
        return;
      }
      if (res.status === 429) {
        // Rate limited
        toast.error('Model is busy. Try again in a moment.');
        // Disable buttons for 10s
        setAiLoading(true);
        setTimeout(() => setAiLoading(false), 10000);
        sendEvent('429_count', 1, { feature: mode === 'complete' ? 'ai_complete' : 'ai_improve' });
        return;
      }
      if (!res.ok) {
        const errorText = await res.text();
        // Unexpected response
        throw new Error('CAREER_ASSISTANT_FAILED');
      }

      const data = await res.json();
      // Response data
      if (data?.cv) {
        // Applying CV data
        const tidyBullets = (list: string[]) => list
          .map(b => b.trim().replace(/^[-•\s]*/, '').replace(/^(i['’]m|i am)\b/i, '').replace(/\s+/g, ' '))
          .map(b => (b[0] ? b[0].toUpperCase() + b.slice(1) : b))
          .map(b => /[.!?]$/.test(b) ? b : b + '.');
        const patch = JSON.parse(JSON.stringify(data.cv));
        if (Array.isArray(patch?.experience)) {
          patch.experience = patch.experience.map((e: any) => ({
            ...e,
            bullets: Array.isArray(e?.bullets) ? tidyBullets(e.bullets).slice(0, 5) : e?.bullets,
          }));
        }
        if (Array.isArray(patch?.projects)) {
          patch.projects = patch.projects.map((p: any) => ({
            ...p,
            bullets: Array.isArray(p?.bullets) ? tidyBullets(p.bullets).slice(0, 5) : p?.bullets,
          }));
        }
        const merged = deepMerge(form.getValues(), patch);
        // Merged data
        form.reset(merged);
        toast.success('AI suggestions applied');
      } else {
        // No CV data in response
        toast.message('AI completed with no changes');
      }
    } catch (e) {
      // Use AI error
      toast.error('Something went wrong. Please try again later.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>{t('customize_cv')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('template_label')}</label>
              <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as 'minimal' | 'modern' | 'creative')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">{t('template_minimal')}</SelectItem>
                  <SelectItem value="modern">{t('template_modern')}</SelectItem>
                  <SelectItem value="creative">{t('template_creative')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

          {/* Optional Job Description */}
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Label htmlFor="review-job-description">Job Description (optional)</Label>
              <Textarea
                id="review-job-description"
                {...(form.register as any)('review.jobDescription')}
                placeholder="Paste a job description to tailor your CV (optional)..."
                rows={4}
              />
              <p className="text-xs text-zinc-500 mt-1">Optional. Paste a job description to tailor wording and keywords.</p>
            </div>
          </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('language_label')}</label>
              <Select value={selectedLanguage} onValueChange={(v) => setSelectedLanguage(v as 'en' | 'ar')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('english')}</SelectItem>
                  <SelectItem value="ar">{t('arabic')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('label_field_of_study')}</label>
              <Select value={fieldOfStudy} onValueChange={(v) => { setFieldOfStudy(v); setAreaOfInterest(''); setSuggestedVacancies(null); }}>
                <SelectTrigger data-testid="field-fieldOfStudy">
                  <SelectValue placeholder={t('placeholder_select_field')} />
                </SelectTrigger>
                <SelectContent>
                  {getFields().map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('label_area_of_interest')}</label>
              <Select 
                value={areaOfInterest}
                onValueChange={(v) => { 
                  setAreaOfInterest(v); 
                  const match = matchSuggestedVacancies(fieldOfStudy, v);
                  if (match) {
                    setSuggestedVacancies(match);
                    setShowInvalidComboToast(false);
                  } else {
                    setSuggestedVacancies(null);
                    if (!showInvalidComboToast) {
                      toast.error(t('invalid_combo'));
                      setShowInvalidComboToast(true);
                    }
                  }
                }}
                disabled={!fieldOfStudy}
              >
                <SelectTrigger data-testid="field-areaOfInterest">
                  <SelectValue placeholder={t('placeholder_select_interest')} />
                </SelectTrigger>
                <SelectContent>
                  {fieldOfStudy && getAreasForField(fieldOfStudy).map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {suggestedVacancies && (
              <div className="md:col-span-2 bg-zinc-50 border border-zinc-200 rounded-md p-3">
                <div className="text-sm font-medium mb-1">{t('suggested_vacancies_title')}</div>
                <ul className="list-disc pl-5 space-y-1">
                  {suggestedVacancies.split('/').map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => useAIAssistant('complete')} variant="default" disabled={aiLoading}>
              {aiLoading ? t('loading') : t('ai_complete_button')}
            </Button>
            <Button onClick={() => useAIAssistant('optimize')} variant="outline" disabled={aiLoading}>
              {aiLoading ? t('loading') : t('ai_improve_button')}
            </Button>
            <Button onClick={exportToPDF} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              {t('export_pdf')}
            </Button>
            <Button onClick={exportToDOCX} variant="outline" disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? t('exporting') : t('export_docx')}
            </Button>
            <Button onClick={submitCV} className="ml-auto" disabled={isSubmitDisabled}>
              {isSubmitDisabled ? t('complete_field_selection') : t('submit_to_knet')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('preview')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`cv-preview ${selectedLanguage === 'ar' ? 'rtl' : 'ltr'}`}>
            {renderTemplate()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
