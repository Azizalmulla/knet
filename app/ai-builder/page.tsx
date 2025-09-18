import AICVBuilder from '@/components/ai-cv-builder';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { redirect } from 'next/navigation';

export default function AIBuilderPage() {
  if (process.env.AI_CV_BUILDER_ENABLED !== 'true') {
    // When disabled, redirect non-admin users to start page
    redirect('/start');
  }
  return (
    <ErrorBoundary>
      <div className="container mx-auto p-4">
        <AICVBuilder />
      </div>
    </ErrorBoundary>
  );
}
