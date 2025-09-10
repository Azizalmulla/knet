'use client';

import AICVBuilder from '@/components/ai-cv-builder';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useLanguage } from '@/lib/language';

export default function AIBuilderPage() {
  const { t } = useLanguage();
  return (
    <ErrorBoundary>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">{t('ai_cv_builder_title')}</h1>
        <AICVBuilder />
      </div>
    </ErrorBoundary>
  );
}
