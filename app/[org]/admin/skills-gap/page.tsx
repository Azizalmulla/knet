'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SkillsGapAnalysis } from '@/components/admin/SkillsGapAnalysis';

export default function AdminSkillsGapPage() {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params?.org as string;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
      <div className="max-w-7xl mx-auto">
        <Button
          onClick={() => router.push(`/${orgSlug}/admin`)}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <SkillsGapAnalysis orgSlug={orgSlug} />
      </div>
    </div>
  );
}
