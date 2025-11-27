'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Save, RotateCcw, Briefcase } from 'lucide-react';
import { useAutosave, loadDraft, clearDraft, hasDraft, getDraftInfo } from '@/lib/autosave';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { PersonalInfoStep } from './cv-steps/personal-info-step';
import { EducationStep } from './cv-steps/education-step';
import { ExperienceProjectsStep } from './cv-steps/experience-projects-step';
import { SkillsStep } from './cv-steps/skills-step';
import { ReviewStep } from './cv-steps/review-step';
import { cvSchema, createLocalizedCvSchema, type CVData, defaultCVValues, stepFields } from '@/lib/cv-schemas';
import { useLanguage } from '@/lib/language';

const steps = [
  { id: 'personal', title: 'Personal Info' },
  { id: 'education', title: 'Education' },
  { id: 'experienceProjects', title: 'Experience & Projects' },
  { id: 'skills', title: 'Skills' },
  { id: 'review', title: 'Review' },
];

interface CVBuilderWizardProps {
  initialData?: CVData | null;
}

export default function CVBuilderWizard({ initialData }: CVBuilderWizardProps = {}) {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const orgSlug = (searchParams as any)?.get?.('org') || undefined;
  const schema = useMemo(() => createLocalizedCvSchema(t), [t]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; cvUrl?: string; id?: string } | null>(null);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ timestamp: number; age: string } | null>(null);
  // Use initialData if provided, otherwise use defaultCVValues
  const [cvData, setCvData] = useState<CVData>(initialData || defaultCVValues);
  const [jobContext, setJobContext] = useState<{ jobId: string; jobTitle: string; company: string } | null>(null);
  
  // Skip draft restore prompt if we have initialData
  const skipDraftRestore = !!initialData;

  const onSubmit = async (data: CVData) => {
    // This is called when the user clicks "Complete" on the Review step
    console.log('Form completed:', data);
    // The actual submit is handled by the Submit button in ReviewStep
    // This just marks the form as complete
    clearDraft();
    console.log('✅ CV Builder completed');
  };

  const getStepTitle = (id: string) => {
    switch (id) {
      case 'personal':
        return t('step_personal');
      case 'education':
        return t('step_education');
      case 'experienceProjects':
        return t('experience_projects_title');
      case 'skills':
        return t('step_skills');
      case 'review':
        return t('step_review');
      default:
        return id;
    }
  };

  const form = useForm<CVData>({
    resolver: zodResolver(schema) as unknown as Resolver<CVData>,
    defaultValues: cvData,
    mode: 'onChange',
    shouldUnregister: false, // Keep values when fields are removed
  });

  // Set up autosave functionality
  useAutosave(form.watch);

  // Check for existing draft and job context on component mount
  useEffect(() => {
    // Skip draft restore if we have initialData from smart entry
    if (!skipDraftRestore && hasDraft()) {
      const info = getDraftInfo();
      setDraftInfo(info);
      setShowDraftRestore(true);
    }
    
    // Check if user came from job application
    if (typeof window !== 'undefined') {
      const returnToJobData = localStorage.getItem('return_to_job');
      if (returnToJobData) {
        try {
          const job = JSON.parse(returnToJobData);
          setJobContext(job);
        } catch {}
      }
    }
  }, []);

  // Listen for external step navigation requests (e.g., from Review 'Go fix')
  useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent)?.detail as { id?: string } | undefined;
        const id = detail?.id;
        if (!id) return;
        const idx = steps.findIndex(s => s.id === id);
        if (idx >= 0) {
          setCurrentStep(idx);
          // Focus a primary field after navigation (Education)
          if (id === 'education') {
            setTimeout(() => {
              try {
                const el = document.querySelector('input[id^="institution-"]') as HTMLInputElement | null;
                el?.focus();
              } catch {}
            }, 50);
          }
          // Scroll to top of the step card
          setTimeout(() => { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} }, 0);
        }
      } catch {}
    };
    try { window.addEventListener('wizard:go-to', handler as any); } catch {}
    return () => { try { window.removeEventListener('wizard:go-to', handler as any); } catch {} };
  }, []);

  const nextStep = async () => {
    // Special handling for the review step "Complete" button
    if (currentStep === steps.length - 1) {
      // On Review step, validate review fields first
      const reviewFields = ['template', 'language'] as const;
      const ok = await form.trigger(reviewFields, { shouldFocus: true });
      if (!ok) return;
      
      // Trigger form submission logic
      const formData = form.getValues();
      await onSubmit(formData);
      return;
    }
    
    const ok = await form.trigger(stepFields[currentStep as keyof typeof stepFields], { shouldFocus: true });
    if (!ok) return;
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      
      // Save to localStorage for draft persistence
      const stepData = form.getValues();
      const updatedData = { ...cvData, ...stepData };
      setCvData(updatedData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cvBuilderDraft', JSON.stringify(updatedData));
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const restoreDraft = () => {
    const draft = loadDraft();
    if (draft) {
      form.reset(draft);
      setCvData(draft);
      setShowDraftRestore(false);
      console.log('📄 Draft restored successfully');
    }
  };

  const dismissDraft = () => {
    clearDraft();
    setShowDraftRestore(false);
    setDraftInfo(null);
  };

  // Handle keyboard events to prevent Enter submission on non-final steps
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentStep < steps.length - 1) {
      e.preventDefault();
      // Attempt to advance with same validation logic
      void nextStep();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <PersonalInfoStep />;
      case 1:
        return <EducationStep />;
      case 2:
        return <ExperienceProjectsStep />;
      case 3:
        return <SkillsStep />;
      case 4:
        return <ReviewStep />;
      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;


  return (
    <div className="min-h-screen bg-[#eeeee4] text-neutral-900">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Draft Restore Notification */}
            {showDraftRestore && draftInfo && (
              <Alert className="mb-6">
                <Save className="h-5 w-5" />
                <AlertTitle>{t('draft_found')}</AlertTitle>
                <AlertDescription>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {t('draft_unsaved_from', { age: draftInfo.age })}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={restoreDraft}
                        data-testid="restore-draft-btn"
                      >
                        <RotateCcw className="h-3 w-3 ltr:mr-1 rtl:ml-1" />
                        {t('restore')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={dismissDraft}
                        data-testid="dismiss-draft-btn"
                      >
                        {t('dismiss')}
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Job Application Context Banner - Sticky */}
            {jobContext && (
              <div className="sticky top-0 z-10 mb-6 p-4 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#ffd6a5] border-[2px] border-black flex items-center justify-center flex-shrink-0">
                    <Briefcase className="w-5 h-5 text-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">Building CV for Job Application</p>
                    <p className="text-sm text-neutral-600 truncate">
                      {jobContext.jobTitle} at {jobContext.company}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Progress */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">{t('ai_cv_builder_title')}</h1>
                <span className="text-sm text-muted-foreground" data-testid="step-indicator">
                  {t('step_indicator', { current: currentStep + 1, total: steps.length })}
                </span>
              </div>
            <Progress value={progress} className="h-2" />
            <div className="hidden sm:flex justify-between mt-2">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={`text-xs ${index <= currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
                >
                  {getStepTitle(step.id)}
                </span>
              ))}
            </div>
            <div className="flex sm:hidden justify-center mt-2">
              <span className="text-xs font-medium text-foreground">
                {getStepTitle(steps[currentStep].id)}
              </span>
            </div>
            </div>

            {/* Step Content */}
            <Card className="mb-8 rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111]" onKeyDown={handleKeyDown}>
              <CardHeader>
                <CardTitle data-testid="step-title">{getStepTitle(steps[currentStep].id)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                  {t('step_indicator', { current: currentStep + 1, total: steps.length })}: {getStepTitle(steps[currentStep].id)}
                </div>
                {renderStep()}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <Button
                variant="outline"
                onClick={prevStep}
                type="button"
                disabled={currentStep === 0}
                data-testid="prev-btn"
                className="w-full sm:w-auto rounded-2xl border-[3px] border-black bg-white text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100 transition-transform"
              >
                ← {t('previous')}
              </Button>
              {currentStep === steps.length - 1 ? (
                <div />
              ) : (
                <Button
                  variant="outline"
                  onClick={nextStep}
                  type="button"
                  data-testid="next-btn"
                  className="w-full sm:w-auto rounded-2xl border-[3px] border-black bg-white text-black shadow-[6px_6px_0_#111] hover:-translate-y-0.5 hover:bg-neutral-100 transition-transform"
                >
                  {t('next')} →
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
