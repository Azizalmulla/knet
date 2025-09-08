'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PersonalInfoStep } from './cv-steps/personal-info-step';
import { EducationStep } from './cv-steps/education-step';
import { ExperienceStep } from './cv-steps/experience-step';
import { ProjectsStep } from './cv-steps/projects-step';
import { SkillsStep } from './cv-steps/skills-step';
import { ReviewStep } from './cv-steps/review-step';
import { 
  personalInfoSchema, 
  educationSchema, 
  experienceSchema, 
  projectsSchema, 
  skillsSchema,
  cvSchema,
  type CVData 
} from '@/lib/cv-schemas';

const steps = [
  { id: 'personal', title: 'Personal Info', schema: personalInfoSchema },
  { id: 'education', title: 'Education', schema: educationSchema },
  { id: 'experience', title: 'Experience', schema: experienceSchema },
  { id: 'projects', title: 'Projects', schema: projectsSchema },
  { id: 'skills', title: 'Skills', schema: skillsSchema },
  { id: 'review', title: 'Review', schema: cvSchema },
];

export default function CVBuilderWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [cvData, setCvData] = useState<Partial<CVData>>({
    template: 'minimal',
    language: 'en',
  });

  const form = useForm({
    resolver: zodResolver(steps[currentStep].schema),
    defaultValues: cvData,
  });

  const nextStep = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      const stepData = form.getValues();
      setCvData(prev => ({ ...prev, ...stepData }));
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
        form.reset({ ...cvData, ...stepData });
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      form.reset(cvData);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <PersonalInfoStep form={form} />;
      case 1:
        return <EducationStep form={form} />;
      case 2:
        return <ExperienceStep form={form} cvData={cvData} />;
      case 3:
        return <ProjectsStep form={form} cvData={cvData} />;
      case 4:
        return <SkillsStep form={form} />;
      case 5:
        return <ReviewStep cvData={{ ...cvData, ...form.getValues() }} />;
      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold">AI CV Builder</h1>
            <span className="text-sm text-zinc-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2">
            {steps.map((step, index) => (
              <span
                key={step.id}
                className={`text-xs ${
                  index <= currentStep ? 'text-zinc-900' : 'text-zinc-400'
                }`}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
          </CardHeader>
          <CardContent>
            {renderStep()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <Button
            onClick={nextStep}
            disabled={currentStep === steps.length - 1}
          >
            {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
