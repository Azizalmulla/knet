'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormContext } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
// Removed template selector UI for now; always use the Professional template
import { CVData } from '@/lib/cv-schemas';
// Removed legacy React-PDF viewer; we now wait for Macchiato HTML only
import { FileText, CheckCircle, RotateCcw } from 'lucide-react';
import { matchSuggestedVacancies } from '@/lib/career-map';
import { normalizeDegree, normalizeArea } from '@/lib/watheefti-taxonomy';
import { COMMON_AREAS_OF_INTEREST } from '@/lib/field-suggestions';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/language';


export function ReviewStep() {
  const form = useFormContext<CVData>();
  const searchParams = useSearchParams();
  const orgSlug = (searchParams?.get('org') || '').trim() || undefined;
  const orgsParam = (searchParams?.get('orgs') || '').trim();
  const orgSlugs = orgsParam ? orgsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10) : [];
  // Lock template to 'professional' (new polished layout)
  const selectedTemplate: 'professional' = 'professional';
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>((((form.getValues() as any)?.language) as 'en' | 'ar') || 'en');
  const [selectedTheme] = useState<'macchiato'>('macchiato');
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'comfortable';
    const v = localStorage.getItem('cv_density');
    return v === 'compact' ? 'compact' : 'comfortable';
  });
  const [fieldOfStudy, setFieldOfStudy] = useState<string>('');
  const [areaOfInterest, setAreaOfInterest] = useState<string>('');
  const [suggestedVacancies, setSuggestedVacancies] = useState<string | null>(null);
  // Unified profile classification (required)
  const [degreeLevel, setDegreeLevel] = useState<string>('');
  const [yoeBucket, setYoeBucket] = useState<string>('');
  const [classificationErrors, setClassificationErrors] = useState<{degree?: string; yoe?: string}>({});
  const [showInvalidComboToast, setShowInvalidComboToast] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  // Macchiato preview state (iframe HTML)
  const [macHtmlUrl, setMacHtmlUrl] = useState<string | null>(null);
  const [macAvailable, setMacAvailable] = useState<boolean>(false);
  const macBuildTimer = useRef<any>(null);
  const [macStatus, setMacStatus] = useState<number | null>(null);
  const [macRendererHeader, setMacRendererHeader] = useState<string | null>(null);
  const [macError, setMacError] = useState<string | null>(null);
  const lastPreviewCvRef = useRef<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finalOnly, setFinalOnly] = useState(false);
  const { t, lang } = useLanguage() as any;
  // Global Undo for Smart Assist
  const undoAssistRef = useRef<any | null>(null);
  const [canUndoAssist, setCanUndoAssist] = useState(false);

  // Prefill review Field of Study from first education item if present
  useEffect(() => {
    try {
      const v = form.getValues() as any;
      const eduFoS = v?.education?.[0]?.fieldOfStudy;
      if (!fieldOfStudy && typeof eduFoS === 'string' && eduFoS.trim()) {
        setFieldOfStudy(eduFoS.trim());
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Persist density to localStorage with debounce
  useEffect(() => {
    let t: any
    try {
      if (typeof window !== 'undefined') {
        t = setTimeout(() => localStorage.setItem('cv_density', density), 150)
      }
    } catch {}
    return () => { if (t) clearTimeout(t) }
  }, [density])

  // Build Macchiato HTML preview via API with debounce (500ms)
  useEffect(() => {
    // Clean previous timer
    if (macBuildTimer.current) clearTimeout(macBuildTimer.current)
    setMacStatus(null)
    setMacRendererHeader(null)
    setMacError(null)
    macBuildTimer.current = setTimeout(async () => {
      try {
        const v = form.getValues();
        // Save exact snapshot used to render the Macchiato preview
        lastPreviewCvRef.current = JSON.parse(JSON.stringify(v));
        const res = await fetch('/api/cv/macchiato/html', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cv: v, theme: selectedTheme }),
        })
        setMacStatus(res.status)
        setMacRendererHeader(res.headers.get('x-renderer'))
        if (!res.ok) {
          setMacAvailable(false)
          try {
            const text = await res.text()
            setMacError(text.slice(0, 200))
          } catch {}
          return
        }
        const html = await res.text()
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        // Revoke previous
        if (macHtmlUrl) URL.revokeObjectURL(macHtmlUrl)
        setMacHtmlUrl(url)
        setMacAvailable(true)
        setMacError(null)
      } catch {
        setMacAvailable(false)
        setMacError('network-error')
      }
    }, 500)
    return () => {
      if (macBuildTimer.current) clearTimeout(macBuildTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch(), selectedTheme])

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (macHtmlUrl) URL.revokeObjectURL(macHtmlUrl) }, [macHtmlUrl])

  const sendEvent = (event: string, value?: number, meta?: any) => {
    try {
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, value, meta }),
      }).catch(() => {});
    } catch {}
  };

  

  // Wizard step navigation (for "Go fix" links)
  const goToStep = (id: 'education' | 'experienceProjects' | 'personal' | 'skills' | 'review') => {
    try { window.dispatchEvent(new CustomEvent('wizard:go-to', { detail: { id } })); } catch {}
  };

  const undoSmartAssist = () => {
    const snap = undoAssistRef.current;
    if (snap) {
      try { form.reset(snap); } catch { /* noop */ }
      undoAssistRef.current = null;
      setCanUndoAssist(false);
      toast.success('Undid Smart Assist changes');
    } else {
      toast.info('Nothing to undo');
    }
  };

  const renderTemplate = () => {
    // Prefer Macchiato HTML iframe when available
    if (macAvailable && macHtmlUrl) {
      return (
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height: 900, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <iframe src={macHtmlUrl} title="Macchiato Preview" style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} />
          </div>
          {process.env.NODE_ENV !== 'production' ? (
            <div className="absolute top-2 right-2 text-xs px-2 py-1 rounded border bg-muted text-muted-foreground border-border select-none">
              Renderer: Macchiato
            </div>
          ) : null}
        </div>
      )
    }
    // While Macchiato is loading: show skeleton loader (avoid flashing old renderer)
    return (
      <div style={{ width: '100%', height: 900, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-muted-foreground" />
          <span>Preparing CV preview…</span>
        </div>
      </div>
    )
  };

  const exportToPDF = async () => {
    try {
      // Use the exact snapshot last used for preview to guarantee Export = Preview
      const v = (lastPreviewCvRef.current ? lastPreviewCvRef.current : form.getValues());
      const payload = { cv: v, template: selectedTemplate, language: selectedLanguage, density, theme: selectedTheme };
      const res = await fetch('/api/cv/macchiato/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const j = await res.json();
            const reason = j?.reason || res.headers.get('x-reason') || '';
            toast.error(`Failed to export PDF${reason ? `: ${reason}` : ''}`);
          } else {
            const reason = res.headers.get('x-reason');
            toast.error(`Failed to export PDF${reason ? `: ${reason}` : ''}`);
          }
        } catch {
          // Fallback
          toast.error(`Failed to export PDF (${res.status})`);
        }
        return;
      }
      const renderer = res.headers.get('x-renderer');
      if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
        try { console.log('Export renderer:', renderer || '(none)'); } catch {}
      }
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
      const payload = { ...(v as any), template: selectedTemplate, language: selectedLanguage, density };
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

  // Relax gating: allow fallbacks from form values if local selections are empty
  const live = form.getValues() as any;
  const effectiveFieldOfStudy = fieldOfStudy || live?.education?.[0]?.fieldOfStudy || '';
  const effectiveAreaOfInterest = areaOfInterest || (live?.skills?.technical?.[0] ?? '');
  const effectiveSuggested = effectiveFieldOfStudy && effectiveAreaOfInterest
    ? (matchSuggestedVacancies(effectiveFieldOfStudy, effectiveAreaOfInterest) || null)
    : null;
  const isSubmitDisabled = isSubmitting || isSubmitted || !effectiveFieldOfStudy || !effectiveAreaOfInterest || !effectiveSuggested;
  const displaySuggested = suggestedVacancies || effectiveSuggested;

  // Derivations for read-only chips (Degree / Field of Study / YoE)
  const derivedDegree: string = (live?.education?.[0]?.degree || '').toString().trim();
  const derivedFoSFromEdu: string = (live?.education?.[0]?.fieldOfStudy || '').toString().trim();
  const nowMonthIndex = (() => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); })();
  const parseMonthIndex = (val: string | undefined, fallbackCurrent: boolean): number | null => {
    if (!val) return fallbackCurrent ? nowMonthIndex : null;
    const v = String(val).trim();
    if (!v || v.toLowerCase() === 'present') return nowMonthIndex;
    const m = /^([0-9]{4})-([0-9]{2})$/.exec(v);
    if (!m) return null;
    const y = parseInt(m[1], 10); const mo = parseInt(m[2], 10) - 1; if (isNaN(y) || isNaN(mo)) return null;
    return y * 12 + mo;
  };
  const computeAutoYoEBucket = (v: any): string => {
    try {
      const items: any[] = Array.isArray(v?.experienceProjects) ? v.experienceProjects : (Array.isArray(v?.experience) ? v.experience : []);
      const exps = items.filter((it: any) => !it.type || it.type === 'experience');
      if (!exps.length) return '0–1';
      const covered = new Set<number>();
      for (const e of exps) {
        const s = parseMonthIndex(e?.startDate, false);
        const endRaw = (e?.endDate || (e?.current ? 'Present' : '')) as string;
        const en = parseMonthIndex(endRaw, !!e?.current);
        if (s == null || en == null) continue;
        const start = Math.min(s, en); const end = Math.max(s, en);
        for (let mi = start; mi <= end; mi++) covered.add(mi);
      }
      const months = covered.size;
      const years = Math.floor(months / 12);
      if (years < 1) return '0–1';
      if (years <= 3) return '2–3';
      if (years <= 5) return '4–5';
      return '6+';
    } catch { return '0–1'; }
  };
  const autoYoEBucket = computeAutoYoEBucket(live);
  const missingDegree = !derivedDegree;
  const missingFoS = !derivedFoSFromEdu;

  const submitCV = async (opts?: { suppressToast?: boolean }) => {
    if (isSubmitted) {
      if (!opts?.suppressToast) {
        toast.success('CV already submitted! ✅');
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

      // Derive classification automatically
      const degRaw = (live?.education?.[0]?.degree || '').toString();
      const norm = (normalizeDegree ? String(normalizeDegree(degRaw)) : degRaw).toLowerCase();
      const degreeBucket = norm.includes('master') ? 'Master’s' : (norm.includes('bachelor') ? 'Bachelor’s' : 'Others');
      const yBucket = autoYoEBucket;

      // Submit final normalized CV JSON to server to generate HTML, store JSON+template, and persist record
      const finalCv = {
        ...(form.getValues() as any),
        template: selectedTemplate,
        language: selectedLanguage,
      };
      // Telemetry: profile_set
      sendEvent('knet_profile_set', 1, { source: 'ai_builder', degreeBucket, yearsOfExperienceBucket: yBucket, areaOfInterest: aoi });

      let okSubmit = false;
      if (orgSlugs.length > 0) {
        // Bulk AI submit to multiple orgs
        const batchId = (globalThis as any)?.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
        for (const slug of orgSlugs.slice(0, 50)) {
          const resp = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...finalCv,
              cvType: 'ai',
              fieldOfStudy: fos,
              areaOfInterest: aoi,
              suggestedVacancies: vac,
              orgSlug: slug,
              isBulk: true,
              bulkBatchId: batchId,
              knetProfile: {
                degreeBucket: degreeBucket,
                yearsOfExperienceBucket: yBucket,
                areaOfInterest: normalizeArea(aoi),
                areaSlug: normalizeArea(aoi).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
                taxonomyVersion: 'v1',
              },
            }),
          })
          if (resp.ok) okSubmit = true;
          if (resp.status === 429) break
        }
      } else {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...finalCv,
            cvType: 'ai',
            fieldOfStudy: fos,
            areaOfInterest: aoi,
            suggestedVacancies: vac,
            orgSlug: orgSlug,
            knetProfile: {
              degreeBucket: degreeBucket,
              yearsOfExperienceBucket: yBucket,
              areaOfInterest: normalizeArea(aoi),
              areaSlug: normalizeArea(aoi).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
              taxonomyVersion: 'v1',
            },
          }),
        });
        okSubmit = response.ok;
      }

      if (okSubmit) {
        setIsSubmitted(true);
        if (!opts?.suppressToast) {
          toast.success('🎉 Successfully submitted! Your CV has been received.', {
            duration: 6000,
            className: 'bg-emerald-50 border-emerald-200 text-emerald-900'
          });
        }
        sendEvent('cv_submit_success', 1, { org: orgSlug || 'unknown' });
      } else {
        toast.error('Submission failed');
        sendEvent('cv_submit_fail', 1, { status: 'unknown', org: orgSlug || 'unknown' });
      }
    } catch (error) {
      console.error('Submission failed:', error);
      toast.error('Failed to submit. Please try again.');
      sendEvent('cv_submit_fail', 1, { error: String(error), org: orgSlug || 'unknown' });
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
        // Union bullets to avoid deletions and count additions
        const next = JSON.parse(JSON.stringify(merged));
        let addedCount = 0;
        const toSet = (arr?: string[]) => new Set((arr || []).filter(Boolean));
        const unionFromSets = (a: Set<string>, b: Set<string>) => new Set<string>([...a, ...b]);
        // experienceProjects path
        if (Array.isArray(next.experienceProjects) && Array.isArray(base.experienceProjects)) {
          const expsAfter = next.experienceProjects;
          const expsBefore = base.experienceProjects;
          expsAfter.forEach((it: any, i: number) => {
            if (!it) return;
            const beforeSet = toSet(expsBefore[i]?.bullets);
            const afterSet = toSet(it.bullets);
            const newItems = [...afterSet].filter(x => !beforeSet.has(x));
            const union = [...unionFromSets(beforeSet, afterSet)];
            addedCount += newItems.length;
            it.bullets = union;
          });
        }
        // legacy experience/projects arrays
        if (Array.isArray(next.experience) && Array.isArray(base.experience)) {
          next.experience.forEach((it: any, i: number) => {
            const beforeSet = toSet(base.experience[i]?.bullets);
            const afterSet = toSet(it?.bullets);
            const newItems = [...afterSet].filter(x => !beforeSet.has(x));
            const union = [...unionFromSets(beforeSet, afterSet)];
            addedCount += newItems.length;
            it.bullets = union;
          });
        }
        if (Array.isArray(next.projects) && Array.isArray(base.projects)) {
          next.projects.forEach((it: any, i: number) => {
            const beforeSet = toSet(base.projects[i]?.bullets);
            const afterSet = toSet(it?.bullets);
            const newItems = [...afterSet].filter(x => !beforeSet.has(x));
            const union = [...unionFromSets(beforeSet, afterSet)];
            addedCount += newItems.length;
            it.bullets = union;
          });
        }
        form.reset(next);
        if (!opts?.quiet) {
          if (addedCount > 0) {
            toast.success(`${addedCount} bullet${addedCount === 1 ? '' : 's'} added`);
          } else {
            toast.message('AI completed with no bullet additions');
          }
        }
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

  // Smart AI Assist — Expand & Improve (No Fabrication)
  const smartAssist = async () => {
    const tidyBulletsLocal = (list: string[]) => (Array.isArray(list) ? list : [])
      .map(b => String(b || '').trim().replace(/^[-•\s]*/, '').replace(/^(i['']m|i am)\b/i, '').replace(/\s+/g, ' '))
      .map(b => (b[0] ? b[0].toUpperCase() + b.slice(1) : b))
      .map(b => /[.!?]$/.test(b) ? b : b + '.');

    const snapBefore = form.getValues() as any;
    // Take snapshot for Undo
    try { undoAssistRef.current = JSON.parse(JSON.stringify(snapBefore)); setCanUndoAssist(true); } catch { undoAssistRef.current = snapBefore; setCanUndoAssist(true); }
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

    try {
      setAiLoading(true);
      const v = form.getValues() as any;
      const payload = {
        mode: 'smartExpand',
        locale: selectedLanguage === 'ar' ? 'ar' : 'en',
        form: v,
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
          try { form.setError(field as any, { type: 'ai', message: 'Required for AI' }); } catch {}
        });
        toast.error('Add the highlighted fields, then retry.');
        return false;
      }
      if (res.status === 429) {
        toast.error('Model is busy. Try again in a moment.');
        setAiLoading(true);
        setTimeout(() => setAiLoading(false), 10000);
        return false;
      }
      if (!res.ok) {
        toast.error('Something went wrong. Please try again later.');
        return false;
      }

      const data = await res.json();
      const next = JSON.parse(JSON.stringify(v));
      // Summary
      if (typeof data?.summary === 'string' && data.summary.trim()) {
        next.summary = data.summary.trim();
      }
      // Update bullets only (preserve entries)
      const applyBullets = (arr: any[], src: any[]) => {
        if (!Array.isArray(arr) || !Array.isArray(src)) return;
        for (let i = 0; i < Math.min(arr.length, src.length); i++) {
          const nb = tidyBulletsLocal(src[i]?.bullets || []).slice(0, 5);
          if (Array.isArray(nb) && nb.length) arr[i].bullets = nb;
        }
      };
      if (Array.isArray(next.experience) && Array.isArray(data?.experience)) {
        applyBullets(next.experience, data.experience);
      } else if (Array.isArray(next.experienceProjects) && Array.isArray(data?.experience)) {
        const exps = next.experienceProjects.filter((it: any) => !it.type || it.type === 'experience');
        applyBullets(exps, data.experience);
      }
      if (Array.isArray(next.projects) && Array.isArray(data?.projects)) {
        applyBullets(next.projects, data.projects);
      } else if (Array.isArray(next.experienceProjects) && Array.isArray(data?.projects)) {
        const projs = next.experienceProjects.filter((it: any) => it.type === 'project');
        applyBullets(projs, data.projects);
      }

      form.reset(next);
      // After successful apply, keep snapshot available for undo
      setCanUndoAssist(true);

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
      return true;
    } catch {
      toast.error('Something went wrong. Please try again later.');
      return false;
    } finally {
      setAiLoading(false);
    }
  };

  // Finish flow: validate -> submit (no automatic AI assist)
  const finishAndSubmit = async () => {
    try {
      setIsFinishing(true);
      // Ensure form has latest template/language selections
      try { form.setValue('template' as any, selectedTemplate as any, { shouldDirty: true }); } catch {}
      try { form.setValue('language' as any, selectedLanguage as any, { shouldDirty: true }); } catch {}
      // Validation gate removed: template/language are fixed and have defaults.
      // Proceed directly to submission to avoid false negatives from schema drift.

      await submitCV({ suppressToast: true });
      toast.success('Your CV is complete and has been submitted.', { duration: 6000 });
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

  // Success screen with dashboard CTA (org-aware)
  if (isSubmitted) {
    // Check if user came from job application
    const returnToJobData = typeof window !== 'undefined' ? localStorage.getItem('return_to_job') : null;
    let returnToJob = null;
    if (returnToJobData) {
      try {
        returnToJob = JSON.parse(returnToJobData);
        // Clear it so it doesn't persist
        if (typeof window !== 'undefined') {
          localStorage.removeItem('return_to_job');
        }
      } catch {}
    }

    return (
      <Card className="max-w-2xl mx-auto rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
        <CardContent className="pt-6 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">{t('success_title')}</h2>
          <p className="text-muted-foreground mb-6">{t('success_subtitle')}</p>
          
          {returnToJob && (
            <div className="mb-6 p-4 rounded-lg bg-green-50 border-[2px] border-green-500 text-left">
              <p className="font-semibold text-green-800 mb-2">
                ✨ Ready to apply!
              </p>
              <p className="text-sm text-green-700">
                Your CV is ready. You can now apply to <strong>{returnToJob.jobTitle}</strong> at {returnToJob.company}
              </p>
            </div>
          )}
          
          <Button 
            asChild 
            className="mt-6 rounded-2xl border-[2px] border-black bg-[#ffd6a5] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-[#ffd6a5]/90 transition-transform"
          >
            <a href={returnToJob ? `/jobs/${returnToJob.jobId}` : (orgSlugs.length > 0 ? "/career/dashboard" : (orgSlug ? `/student/dashboard?org=${orgSlug}` : "/start"))}>
              {returnToJob ? `Apply to ${returnToJob.jobTitle} →` : t('back_to_dashboard')}
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

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
        <p className="text-sm text-muted-foreground">Preview your CV below. Once you’re ready, submit it for review and job matching.</p>
      </div>

      {/* Profile Overview (derived chips; no inputs) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile_classification_required') || 'Profile Classification (Required)'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t('degree_watheefti') || 'Degree'}</div>
              {derivedDegree ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-foreground border border-border">{derivedDegree}</span>
              ) : (
                <div className="text-xs text-destructive">{t('missing_label')} — <button type="button" className="underline" onClick={(e) => { e.preventDefault(); goToStep('education'); }}>{t('go_fix')}</button></div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t('edu_field') || 'Field of Study'}</div>
              {derivedFoSFromEdu ? (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-foreground border border-border">{derivedFoSFromEdu}</span>
              ) : (
                <div className="text-xs text-destructive">{t('missing_label')} — <button type="button" className="underline" onClick={(e) => { e.preventDefault(); goToStep('education'); }}>{t('go_fix')}</button></div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">{t('yoe_watheefti') || 'Years of Experience'}</div>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted text-foreground border border-border">{autoYoEBucket}</span>
              {!Array.isArray(live?.experienceProjects) && !Array.isArray(live?.experience) && (
                <div className="text-xs text-muted-foreground mt-1">Defaulting to 0–1</div>
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
          <div className="grid grid-cols-1 gap-2">
            <div>
              <Label htmlFor="review-job-description">Job Description (optional)</Label>
              <Textarea
                id="review-job-description"
                {...(form.register as any)('review.jobDescription')}
                placeholder={t('jd_helper')}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('jd_helper')}</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="review-certifications">Certifications (one per line)</Label>
                <Textarea
                  id="review-certifications"
                  {...(form.register as any)('review.certifications')}
                  placeholder="e.g. AWS Certified Cloud Practitioner\nGoogle Data Analytics Certificate"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">Shown in PDF/DOCX, capped to 6 items.</p>
              </div>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t('label_area_of_interest')}</label>
              <Input
                value={areaOfInterest}
                onChange={(e) => { 
                  const v = e.target.value;
                  setAreaOfInterest(v); 
                  const match = matchSuggestedVacancies(effectiveFieldOfStudy, v);
                  if (match) {
                    setSuggestedVacancies(match);
                    setShowInvalidComboToast(false);
                  } else {
                    setSuggestedVacancies(null);
                  }
                }}
                placeholder="e.g., Software Development, Marketing, Finance..."
                list="review-area-suggestions"
                autoComplete="off"
                data-testid="field-areaOfInterest"
              />
              <datalist id="review-area-suggestions">
                {COMMON_AREAS_OF_INTEREST.map(area => (
                  <option key={area} value={area} />
                ))}
              </datalist>
              <p className="text-xs text-muted-foreground mt-1">
                Start typing to see suggestions, or enter your own
              </p>
            </div>
            {displaySuggested && (
              <div className="md:col-span-2 bg-muted border border-border rounded-md p-3">
                <div className="text-sm font-medium mb-1">{t('suggested_vacancies_title')}</div>
                <ul className="list-disc ltr:pl-5 rtl:pr-5 space-y-1">
                  {displaySuggested.split('/').map(item => (
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
            <Button onClick={undoSmartAssist} variant="outline" disabled={!canUndoAssist} title="Undo last Smart Assist changes">
              <RotateCcw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
              Undo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('smart_assist_helper')}</p>
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
          variant="outline"
          className="rounded-2xl border-[3px] border-black bg-white text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100 transition-transform"
          disabled={aiLoading || isSubmitting || isFinishing}
        >
          {isFinishing || isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black ltr:mr-2 rtl:ml-2"></div>
              Finishing…
            </>
          ) : (
            'Finish & Submit'
          )}
        </Button>
      </div>
    </div>
  );
}
