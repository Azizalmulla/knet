'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { InterviewScheduling } from '@/components/admin/InterviewScheduling';

export default function AdminSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params?.org as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        <Button
          onClick={() => router.push(`/${orgSlug}/admin`)}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <InterviewScheduling orgSlug={orgSlug} />
      </div>
    </div>
  );
}
