'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, CheckCircle, AlertCircle, Save, RotateCcw } from 'lucide-react';
import { useAutosave, loadDraft, clearDraft, hasDraft, getDraftInfo } from '@/lib/autosave';
import { PersonalInfoStep } from './cv-steps/personal-info-step';
import { EducationStep } from './cv-steps/education-step';
import { ExperienceStep } from './cv-steps/experience-step';
import { ProjectsStep } from './cv-steps/projects-step';
import { SkillsStep } from './cv-steps/skills-step';
import { ReviewStep } from './cv-steps/review-step';
import { cvSchema, createLocalizedCvSchema, type CVData, defaultCVValues, stepFields } from '@/lib/cv-schemas';
import { useLanguage } from '@/lib/language';

const steps = [
  { id: 'personal', title: 'Personal Info' },
  { id: 'education', title: 'Education' },
  { id: 'experience', title: 'Experience' },
  { id: 'projects', title: 'Projects' },
  { id: 'skills', title: 'Skills' },
  { id: 'review', title: 'Review' },
];

export default function CVBuilderWizard() {
  const { t } = useLanguage();
  const schema = useMemo(() => createLocalizedCvSchema(t), [t]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; cvUrl?: string; id?: string } | null>(null);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ timestamp: number; age: string } | null>(null);
  const [cvData, setCvData] = useState<CVData>(defaultCVValues);

  const onSubmit = async (data: CVData) => {
    // This is called when the user clicks "Complete" on the Review step
    console.log('Form completed:', data);
    // The actual submit to KNET is handled by the Submit button in ReviewStep
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
      case 'experience':
        return t('step_experience');
      case 'projects':
        return t('step_projects');
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

  // Check for existing draft on component mount
  useEffect(() => {
    if (hasDraft()) {
      const info = getDraftInfo();
      setDraftInfo(info);
      setShowDraftRestore(true);
    }
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
        return <ExperienceStep />;
      case 3:
        return <ProjectsStep />;
      case 4:
        return <SkillsStep />;
      case 5:
        return <ReviewStep />;
      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;


  return (
    <div className="min-h-screen bg-background text-foreground" style={{ backgroundColor: '#000', color: '#fff' }}>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {/* Draft Restore Notification */}
            {showDraftRestore && draftInfo && (
              <Card className="mb-6 border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Save className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">
                          {t('draft_found')}
                        </p>
                        <p className="text-xs text-blue-700">
                          {t('draft_unsaved_from', { age: draftInfo.age })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={restoreDraft}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        data-testid="restore-draft-btn"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
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
                </CardContent>
              </Card>
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
            <div className="flex justify-between mt-2">
              {steps.map((step, index) => (
                <span
                  key={step.id}
                  className={`text-xs ${index <= currentStep ? 'text-foreground' : 'text-muted-foreground'}`}
                >
                  {getStepTitle(step.id)}
                </span>
              ))}
            </div>
            </div>

            {/* Step Content */}
            <Card className="mb-8" onKeyDown={handleKeyDown}>
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
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={prevStep}
                type="button"
                disabled={currentStep === 0}
                data-testid="prev-btn"
              >
                {t('previous')}
              </Button>
              {currentStep === steps.length - 1 ? (
                <Button
                  data-testid="complete-btn"
                  type="submit"
                  onClick={async (e) => {
                    const ok = await form.trigger(['template', 'language'], { shouldFocus: true });
                    if (!ok) {
                      e.preventDefault();
                      return;
                    }
                  }}
                >
                  {t('complete')}
                </Button>
              ) : (
                <Button
                  onClick={nextStep}
                  type="button"
                  data-testid="next-btn"
                >
                  {t('next')}
                </Button>
              )}
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
}
