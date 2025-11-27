'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CVBuilderWizard from './cv-builder-wizard';
import { SmartCVEntry } from './SmartCVEntry';
import type { CVData } from '@/lib/cv-schemas';

export default function AICVBuilder() {
  const searchParams = useSearchParams();
  const orgSlug = searchParams?.get('org') || undefined;
  
  // Check if we have prefilled data from URL (e.g., from voice-to-cv)
  const prefillParam = searchParams?.get('prefill');
  const hasPrefill = !!prefillParam;
  
  const [showWizard, setShowWizard] = useState(hasPrefill);
  const [initialData, setInitialData] = useState<CVData | null>(() => {
    if (prefillParam) {
      try {
        return JSON.parse(decodeURIComponent(prefillParam));
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleSmartEntryComplete = (cvData: CVData) => {
    setInitialData(cvData);
    setShowWizard(true);
  };

  // If we have initial data or user completed smart entry, show wizard
  if (showWizard) {
    return <CVBuilderWizard initialData={initialData} />;
  }

  // Otherwise show smart entry
  return <SmartCVEntry onComplete={handleSmartEntryComplete} orgSlug={orgSlug} />;
}
