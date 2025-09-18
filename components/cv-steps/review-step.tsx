'use client';

import { useState, useEffect } from 'react';
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
import { FileText } from 'lucide-react';
import { getFields, getAreasForField, matchSuggestedVacancies } from '@/lib/career-map';
import { WatheeftiDegreeBuckets, WatheeftiYoEBuckets, WatheeftiAreas } from '@/lib/watheefti-taxonomy';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/language';
 

export function ReviewStep() {
  const form = useFormContext<CVData>();
  const [selectedTemplate, setSelectedTemplate] = useState<'minimal' | 'modern' | 'creative'>(((form.getValues() as any)?.template) || 'minimal');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>((((form.getValues() as any)?.language) as 'en' | 'ar') || 'en');
  const [fieldOfStudy, setFieldOfStudy] = useState<string>('');
  const [areaOfInterest, setAreaOfInterest] = useState<string>('');
  const [suggestedVacancies, setSuggestedVacancies] = useState<string | null>(null);
  // Watheefti profile classification (required)
  const [knetDegree, setKnetDegree] = useState<string>('');
  const [knetYoE, setKnetYoE] = useState<string>('');
  const [knetArea, setKnetArea] = useState<string>('');
  const [knetErrors, setKnetErrors] = useState<{degree?: string; yoe?: string; area?: string}>({});
  const [showInvalidComboToast, setShowInvalidComboToast] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finalOnly, setFinalOnly] = useState(false);
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
    const live = form.getValues();
    const templateData = { ...(live as any), template: selectedTemplate, language: selectedLanguage };
    
    switch (selectedTemplate) {
      case 'modern':
        return <ModernTemplate data={templateData} />;
      case 'creative':
        return <CreativeTemplate data={templateData} />;
      default:
        return <MinimalTemplate data={templateData} />;
    }
  };

  const exportToPDF = async () => {
    try {
      const v = form.getValues();
      const payload = { cv: v, template: selectedTemplate, language: selectedLanguage };
      const res = await fetch('/api/cv/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`PDF export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name: string = (v as any)?.fullName || (v as any)?.personalInfo?.fullName || 'CV';
      a.href = url;
      a.download = `${String(name).replace(/\s+/g, '_')}_CV.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      toast.error('Failed to export PDF');
    }
  };

  const saveDraftNow = () => {
    try {
      const data = form.getValues();
      if (typeof window !== 'undefined') {
        localStorage.setItem('cvBuilderDraft', JSON.stringify(data));
        toast.success('Draft saved');
      }
    } catch {}
  };

  const exportToDOCX = async () => {
    setIsExporting(true);
    try {
      const v = form.getValues();
      const payload = { ...(v as any), template: selectedTemplate, language: selectedLanguage };
      const response = await fetch('/api/export/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const rv: any = v as any;
        const name = (rv.fullName || rv?.personalInfo?.fullName || 'CV').toString();
        a.download = `${name.replace(/\s+/g, '_')}_CV.docx`;
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

  const isSubmitDisabled = !fieldOfStudy || !areaOfInterest || !suggestedVacancies || isSubmitting || isSubmitted;

  const submitCV = async (opts?: { suppressToast?: boolean }) => {
    if (isSubmitted) {
      if (!opts?.suppressToast) {
        toast.success('CV already submitted to KNET! ✅');
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      const v = form.getValues();
      const pv: any = (v as any).personalInfo || {};
      // Derive required fields from state OR form data to avoid client-side early exit
      const fos = fieldOfStudy || (v as any).education?.[0]?.fieldOfStudy || '';
      const aoi = areaOfInterest || (v as any)?.skills?.technical?.[0] || '';
      if (!fos || !aoi) {
        toast.error(t('complete_field_selection'));
        setIsSubmitting(false);
        return;
      }
      const vac = suggestedVacancies || matchSuggestedVacancies(fos, aoi) || '';

      // Validate Watheefti required selections
      const errs: {degree?: string; yoe?: string; area?: string} = {};
      if (!knetDegree) errs.degree = 'Please choose an option';
      if (!knetYoE) errs.yoe = 'Please choose an option';
      if (!knetArea) errs.area = 'Please choose an option';
      setKnetErrors(errs);
      if (errs.degree || errs.yoe || errs.area) {
        toast.error('Please complete Profile Classification selections.');
        setIsSubmitting(false);
        return;
      }

      // Submit final normalized CV JSON to server to generate HTML, store JSON+template, and persist record
      const finalCv = {
        ...(form.getValues() as any),
        template: selectedTemplate,
        language: selectedLanguage,
      };
      // Telemetry: knet_profile_set
      sendEvent('knet_profile_set', 1, { source: 'ai_builder', degree: knetDegree, yoe: knetYoE, aoi: knetArea });

      const response = await fetch('/api/cv/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...finalCv,
          fieldOfStudy: fos,
          areaOfInterest: aoi,
          suggestedVacancies: vac,
          knetProfile: {
            degreeBucket: knetDegree,
            yearsOfExperienceBucket: knetYoE,
            areaOfInterest: knetArea,
          },
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        if (!opts?.suppressToast) {
          toast.success('🎉 Successfully submitted to KNET! Your CV has been received.', {
            duration: 6000,
            className: 'bg-emerald-50 border-emerald-200 text-emerald-900'
          });
        }
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
    } finally {
      setIsSubmitting(false);
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
    // Handle new experienceProjects structure
    if (v.experienceProjects?.length > 0) {
      const experiences = v.experienceProjects.filter((item: any) => item.type === 'experience');
      const projects = v.experienceProjects.filter((item: any) => item.type === 'project');
      
      if (experiences.length > 0) {
        parts.push(`Experience: ${experiences.map((e: any) => `${e.position} at ${e.company}`).join('; ')}`);
      }
      if (projects.length > 0) {
        parts.push(`Projects: ${projects.map((p: any) => p.name).join('; ')}`);
      }
    }
    // Fallback to legacy fields for backwards compatibility
    else {
      if (v.experience?.length > 0) {
        parts.push(`Experience: ${v.experience.map((e: any) => `${e.position} at ${e.company}`).join('; ')}`);
      }
      if (v.projects?.length > 0) {
        parts.push(`Projects: ${v.projects.map((p: any) => p.name).join('; ')}`);
      }
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
  const useAIAssistant = async (mode: 'complete' | 'optimize', opts?: { quiet?: boolean }): Promise<boolean> => {
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
          experience: (rv.experienceProjects || rv.experience || []).filter((item: any) => !item.type || item.type === 'experience').map((e: any) => ({
            title: e?.title || e?.position || '',
            company: e?.company || '',
            location: e?.location || '',
            startDate: e?.startDate || '',
            endDate: e?.endDate || '',
            bullets: Array.isArray(e?.bullets) ? e.bullets : [],
            technologies: Array.isArray(e?.technologies) ? e.technologies : [],
          })),
          projects: (rv.experienceProjects || rv.projects || []).filter((item: any) => item.type === 'project' || (!item.type && item.name)).map((p: any) => ({
            name: p?.name || '',
            description: p?.description || '',
            technologies: Array.isArray(p?.technologies) ? p.technologies : [],
            url: p?.url || '',
            bullets: Array.isArray(p?.bullets) ? p.bullets : [],
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
        if (!opts?.quiet) toast.error('Add the highlighted fields, then retry.');
        sendEvent('422_count', 1, { feature: mode === 'complete' ? 'ai_complete' : 'ai_improve' });
        return false;
      }
      if (res.status === 429) {
        // Rate limited
        if (!opts?.quiet) toast.error('Model is busy. Try again in a moment.');
        // Disable buttons for 10s
        setAiLoading(true);
        setTimeout(() => setAiLoading(false), 10000);
        sendEvent('429_count', 1, { feature: mode === 'complete' ? 'ai_complete' : 'ai_improve' });
        return false;
      }
      if (!res.ok) {
        const errorText = await res.text();
        // Unexpected response
        throw new Error('CAREER_ASSISTANT_FAILED');
      }

      const data = await res.json();
      // Response data
      if (data?.cv) {
        // Applying CV data with normalization to our front-end schema
        const tidyBullets = (list: string[]) => list
          .map(b => b.trim().replace(/^[-•\s]*/, '').replace(/^(i['’]m|i am)\b/i, '').replace(/\s+/g, ' '))
          .map(b => (b[0] ? b[0].toUpperCase() + b.slice(1) : b))
          .map(b => /[.!?]$/.test(b) ? b : b + '.');

        const base = form.getValues() as any;
        const hadAnyExperience = Array.isArray(base.experienceProjects)
          ? base.experienceProjects.some((it: any) => !it.type || it.type === 'experience')
          : Array.isArray(base.experience) && base.experience.length > 0;

        const patch = JSON.parse(JSON.stringify(data.cv));

        const normalizeCv = (p: any) => {
          const out: any = {};
          // Flatten personal info and top-level summary
          if (p.personalInfo) {
            if (p.personalInfo.fullName != null) out.fullName = p.personalInfo.fullName;
            if (p.personalInfo.email != null) out.email = p.personalInfo.email;
            if (p.personalInfo.phone != null) out.phone = p.personalInfo.phone;
            if (p.personalInfo.location != null) out.location = p.personalInfo.location;
            if (p.personalInfo.summary != null) out.summary = p.personalInfo.summary;
          }
          if (typeof p.summary === 'string' && p.summary.trim()) {
            out.summary = p.summary.trim();
          }
          // Education (map org/start/end -> institution/startDate/endDate)
          if (Array.isArray(p.education)) {
            out.education = p.education.map((e: any) => ({
              degree: e?.degree || '',
              institution: e?.institution || e?.org || '',
              location: e?.location || '',
              startDate: e?.startDate || e?.start || '',
              endDate: e?.endDate || e?.end || e?.graduationDate || '',
              details: Array.isArray(e?.details) ? e.details : [],
              gpa: e?.gpa || undefined,
            }));
          }
          // Experience (map title/start/end)
          if (Array.isArray(p.experience)) {
            const mapped = p.experience.map((e: any) => ({
              company: e?.company || '',
              position: e?.position || e?.title || '',
              startDate: e?.startDate || e?.start || '',
              endDate: e?.endDate || e?.end || '',
              current: e?.current ?? (!e?.end && !e?.endDate),
              description: e?.description || '',
              bullets: Array.isArray(e?.bullets) ? tidyBullets(e.bullets).slice(0, 5) : [],
            }));
            out.experience = mapped;
          }
          // Projects (map tech -> technologies)
          if (Array.isArray(p.projects)) {
            out.projects = p.projects.map((proj: any) => ({
              name: proj?.name || '',
              description: proj?.description || '',
              technologies: Array.isArray(proj?.technologies) ? proj.technologies : (Array.isArray(proj?.tech) ? proj.tech : []),
              url: proj?.url || proj?.link || '',
              bullets: Array.isArray(proj?.bullets) ? tidyBullets(proj.bullets).slice(0, 5) : [],
            }));
          }
          // Skills -> UI shape (merge groups)
          if (p.skills) {
            const s = p.skills;
            const technical: string[] = []
              .concat(Array.isArray(s.technical) ? s.technical : [])
              .concat(Array.isArray(s.frameworks) ? s.frameworks : [])
              .concat(Array.isArray(s.tools) ? s.tools : [])
              .concat(Array.isArray(s.databases) ? s.databases : [])
              .concat(Array.isArray(s.cloud) ? s.cloud : [])
              .concat(Array.isArray(s.programmingLanguages) ? s.programmingLanguages : [])
              .concat(Array.isArray(s.frameworksLibraries) ? s.frameworksLibraries : [])
              .concat(Array.isArray(s.toolsPlatforms) ? s.toolsPlatforms : []);
            const languages = Array.isArray(s.languages) ? s.languages : undefined;
            const soft = Array.isArray(s.soft) ? s.soft : (Array.isArray(s.softSkills) ? s.softSkills : undefined);
            out.skills = {
              technical: Array.from(new Set(technical.filter(Boolean))),
              languages,
              soft,
            };
          }
          // Fold experienceProjects if present
          if (Array.isArray(p.experienceProjects)) {
            const exps = p.experienceProjects.filter((it: any) => !it.type || it.type === 'experience').map((e: any) => ({
              company: e?.company || '',
              position: e?.position || e?.title || '',
              startDate: e?.startDate || e?.start || '',
              endDate: e?.endDate || e?.end || '',
              current: e?.current ?? (!e?.end && !e?.endDate),
              description: e?.description || '',
              bullets: Array.isArray(e?.bullets) ? tidyBullets(e.bullets).slice(0, 5) : [],
            }));
            const projs = p.experienceProjects.filter((it: any) => it.type === 'project').map((pr: any) => ({
              name: pr?.name || '',
              description: pr?.description || '',
              technologies: Array.isArray(pr?.technologies) ? pr.technologies : [],
              url: pr?.url || '',
              bullets: Array.isArray(pr?.bullets) ? tidyBullets(pr.bullets).slice(0, 5) : [],
            }));
            if (exps.length) out.experience = (out.experience || []).concat(exps);
            if (projs.length) out.projects = (out.projects || []).concat(projs);
          }
          // Guardrails: if user had no experience, do not accept newly invented jobs
          if (!hadAnyExperience) {
            out.experience = [];
          }
          return out;
        };

        const normalized = normalizeCv(patch);
        const merged = deepMerge(form.getValues(), normalized);
        form.reset(merged);
        if (!opts?.quiet) toast.success(mode === 'complete' ? 'Completed missing sections' : 'Improved your CV', { duration: 2000 });
        return true;
      } else {
        // No CV data in response
        if (!opts?.quiet) toast.message('AI completed with no changes');
        return true;
      }
    } catch (e) {
      // Use AI error
      if (!opts?.quiet) toast.error('Something went wrong. Please try again later.');
      return false;
    } finally {
      setAiLoading(false);
    }
  };

  // Improve only the summary using dedicated endpoint mode
  const improveSummary = async (): Promise<boolean> => {
    try {
      setAiLoading(true);
      const v = form.getValues();
      const rv: any = v as any;
      const payload = {
        mode: 'summary',
        variant: 'stronger',
        locale: selectedLanguage === 'ar' ? 'ar' : 'en',
        form: {
          personalInfo: rv.personalInfo || {},
          education: rv.education || [],
          experience: Array.isArray(rv.experienceProjects)
            ? rv.experienceProjects.filter((it: any) => !it.type || it.type === 'experience')
            : (rv.experience || []),
          projects: Array.isArray(rv.experienceProjects)
            ? rv.experienceProjects.filter((it: any) => it.type === 'project')
            : (rv.projects || []),
          skills: rv.skills || {},
        },
      };
      const res = await fetch('/api/ai/career-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data?.cv?.personalInfo?.summary) {
        const merged = deepMerge(form.getValues(), { summary: data.cv.personalInfo.summary });
        form.reset(merged);
      }
      return true;
    } catch {
      return false;
    } finally {
      setAiLoading(false);
    }
  };

  // Smart AI Assist: finalize CV by completing then improving in one action (no extra options)
  const smartAssist = async () => {
    const snapBefore = form.getValues() as any;
    const countItems = (v: any) => ({
      exp: Array.isArray(v?.experience) ? v.experience.length : Array.isArray(v?.experienceProjects) ? v.experienceProjects.filter((it: any) => !it.type || it.type === 'experience').length : 0,
      proj: Array.isArray(v?.projects) ? v.projects.length : Array.isArray(v?.experienceProjects) ? v.experienceProjects.filter((it: any) => it.type === 'project').length : 0,
      bullets: (
        (Array.isArray(v?.experience) ? v.experience : [])
          .reduce((acc: number, e: any) => acc + (Array.isArray(e?.bullets) ? e.bullets.length : 0), 0) +
        (Array.isArray(v?.projects) ? v.projects : [])
          .reduce((acc: number, p: any) => acc + (Array.isArray(p?.bullets) ? p.bullets.length : 0), 0)
      ),
      summary: typeof v?.summary === 'string' && v.summary.trim().length > 0
    });
    const beforeCounts = countItems(snapBefore);
    // Complete missing areas → optimize all wording → strengthen summary
    const okComplete = await useAIAssistant('complete', { quiet: true });
    const okOptimize = await useAIAssistant('optimize', { quiet: true });
    const okSummary = await improveSummary();
    const ok = !!(okComplete && okOptimize && okSummary);
    if (ok) {
      // Keep current view; do not navigate or switch to final-only
      const after = form.getValues() as any;
      const afterCounts = countItems(after);
      const deltaProj = Math.max(0, (afterCounts.proj || 0) - (beforeCounts.proj || 0));
      const deltaBullets = Math.max(0, (afterCounts.bullets || 0) - (beforeCounts.bullets || 0));
      const summaryChanged = (!beforeCounts.summary && afterCounts.summary) || (snapBefore?.summary !== after?.summary);
      const parts: string[] = [];
      if (deltaProj > 0) parts.push(`+ ${deltaProj} project${deltaProj > 1 ? 's' : ''}`);
      if (deltaBullets > 0) parts.push(`+ ${deltaBullets} bullet${deltaBullets > 1 ? 's' : ''}`);
      if (summaryChanged) parts.push('reworded summary');
      const msg = parts.length ? parts.join(', ') : 'Updated content';
      toast.success(`Smart AI Assist — ${msg}`);
    }
    return ok;
  };

  // Finish flow: validate -> AI assist -> submit to KNET
  const finishAndSubmit = async () => {
    try {
      setIsFinishing(true);
      // Ensure form has latest template/language selections
      try { form.setValue('template' as any, selectedTemplate as any, { shouldDirty: true }); } catch {}
      try { form.setValue('language' as any, selectedLanguage as any, { shouldDirty: true }); } catch {}
      const ok = await form.trigger(['template' as any, 'language' as any], { shouldFocus: true });
      if (!ok) {
        toast.error('Please complete required fields');
        setIsFinishing(false);
        return;
      }

      const aiOk = await smartAssist();
      if (!aiOk) {
        // Error toast already shown by smartAssist
        setIsFinishing(false);
        return;
      }

      await submitCV({ suppressToast: true });
      toast.success('Your CV is complete and has been submitted to KNET ', { duration: 6000 });
    } finally {
      setIsFinishing(false);
    }
  };

  // Listen for wizard's bottom Complete button to trigger finish flow
  useEffect(() => {
    const handler = () => { void finishAndSubmit(); };
    try {
      window.addEventListener('review:finish-and-submit', handler as any);
    } catch {}
    return () => {
      try { window.removeEventListener('review:finish-and-submit', handler as any); } catch {}
    };
  }, []);

  if (finalOnly) {
    // Output only the improved, finished CV — no extra explanations or options
    return (
      <div className={`cv-preview ${selectedLanguage === 'ar' ? 'rtl' : 'ltr'}`}>
        {renderTemplate()}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heading and helper text */}
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Review Your CV</h2>
        <p className="text-sm text-muted-foreground">Preview your CV below. Once you’re ready, submit it to KNET for review and job matching.</p>
      </div>

      {/* Profile Classification (Required) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile_classification_required') || 'Profile Classification (Required)'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="knetDegree">{t('degree_watheefti') || 'Degree (Watheefti)'}</Label>
              <Select value={knetDegree} onValueChange={(v) => { setKnetDegree(v); setKnetErrors(prev => ({ ...prev, degree: undefined })); }}>
                <SelectTrigger id="knetDegree">
                  <SelectValue placeholder={t('select_degree') || 'Select degree'} />
                </SelectTrigger>
                <SelectContent>
                  {WatheeftiDegreeBuckets.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {knetErrors.degree && (
                <p className="text-sm text-destructive mt-1">{t('please_choose_option') || knetErrors.degree}</p>
              )}
            </div>
            <div>
              <Label htmlFor="knetYoE">{t('yoe_watheefti') || 'Years of Experience (Watheefti)'}</Label>
              <Select value={knetYoE} onValueChange={(v) => { setKnetYoE(v); setKnetErrors(prev => ({ ...prev, yoe: undefined })); }}>
                <SelectTrigger id="knetYoE">
                  <SelectValue placeholder={t('select_yoe') || 'Select years of experience'} />
                </SelectTrigger>
                <SelectContent>
                  {WatheeftiYoEBuckets.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {knetErrors.yoe && (
                <p className="text-sm text-destructive mt-1">{t('please_choose_option') || knetErrors.yoe}</p>
              )}
            </div>
            <div>
              <Label htmlFor="knetArea">{t('aoi_watheefti') || 'Area of Interest (Watheefti)'}</Label>
              <Select value={knetArea} onValueChange={(v) => { setKnetArea(v); setKnetErrors(prev => ({ ...prev, area: undefined })); }}>
                <SelectTrigger id="knetArea">
                  <SelectValue placeholder={t('select_area') || 'Select area of interest'} />
                </SelectTrigger>
                <SelectContent>
                  {WatheeftiAreas.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {knetErrors.area && (
                <p className="text-sm text-destructive mt-1">{t('please_choose_option') || knetErrors.area}</p>
              )}
            </div>
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

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>{t('customize_cv')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('template_label')}</label>
              <Select value={selectedTemplate} onValueChange={(v) => { setSelectedTemplate(v as 'minimal' | 'modern' | 'creative'); try { form.setValue('template' as any, v as any, { shouldDirty: true }); } catch {} }}>
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
              <p className="text-xs text-muted-foreground mt-1">Optional. Paste a job description to tailor wording and keywords.</p>
            </div>
          </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t('language_label')}</label>
              <Select value={selectedLanguage} onValueChange={(v) => { setSelectedLanguage(v as 'en' | 'ar'); try { form.setValue('language' as any, v as any, { shouldDirty: true }); } catch {} }}>
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
              <div className="md:col-span-2 bg-muted border border-border rounded-md p-3">
                <div className="text-sm font-medium mb-1">{t('suggested_vacancies_title')}</div>
                <ul className="list-disc ltr:pl-5 rtl:pr-5 space-y-1">
                  {suggestedVacancies.split('/').map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => smartAssist()} disabled={aiLoading} title="Fills missing sections, adds strong bullet points, and polishes wording. No fake jobs or dates.">
              {aiLoading ? 'Working…' : 'Smart AI Assist — Expand & Improve'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bottom actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button onClick={exportToPDF} variant="outline">
          <FileText className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
          {t('export_pdf')}
        </Button>
        <Button onClick={saveDraftNow} variant="outline">
          Save Draft
        </Button>
        <Button 
          onClick={finishAndSubmit}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={aiLoading || isSubmitting || isFinishing}
        >
          {isFinishing || isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ltr:mr-2 rtl:ml-2"></div>
              Finishing…
            </>
          ) : (
            'Finish & Submit to KNET'
          )}
        </Button>
      </div>
    </div>
  );
}
