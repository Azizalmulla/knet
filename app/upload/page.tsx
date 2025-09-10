'use client';

import nextDynamic from 'next/dynamic';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useLanguage } from '@/lib/language';

export const dynamic = 'force-dynamic';

const UploadCVForm = nextDynamic(() => import('@/components/upload-cv-form'), {
  ssr: false,
});

export default function UploadPage() {
  const { t } = useLanguage();
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">{t('upload_title')}</h1>
            <p className="text-gray-600">{t('upload_subtitle')}</p>
          </div>
          <UploadCVForm />
        </div>
      </div>
    </ErrorBoundary>
  );
}
