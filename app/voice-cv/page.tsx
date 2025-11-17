'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { VoiceToCVBuilder } from '@/components/VoiceToCVBuilder';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function VoiceCVContent() {
  const searchParams = useSearchParams();
  const orgSlug = searchParams?.get('org') || undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-2">
              🎙️ Voice-to-CV Builder
            </h1>
            <p className="text-lg text-gray-600">
              Create your professional CV by speaking - no typing needed!
            </p>
          </div>
          <Link href={orgSlug ? `/${orgSlug}/start` : '/'}>
            <Button variant="outline" className="border-2 border-black">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* How It Works */}
        <Card className="border-4 border-purple-500 shadow-[8px_8px_0px_0px_rgba(168,85,247,1)] bg-gradient-to-r from-purple-50 to-blue-50">
          <CardContent className="p-6">
            <h2 className="text-2xl font-black mb-4">How It Works (3 Steps)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border-2 border-black rounded-lg bg-white">
                <div className="text-3xl font-black mb-2">1️⃣</div>
                <h3 className="font-bold mb-1">Record</h3>
                <p className="text-sm text-gray-600">
                  Speak for 2-3 minutes about your background
                </p>
              </div>
              <div className="p-4 border-2 border-black rounded-lg bg-white">
                <div className="text-3xl font-black mb-2">2️⃣</div>
                <h3 className="font-bold mb-1">AI Processing</h3>
                <p className="text-sm text-gray-600">
                  Our AI transcribes and structures your CV
                </p>
              </div>
              <div className="p-4 border-2 border-black rounded-lg bg-white">
                <div className="text-3xl font-black mb-2">3️⃣</div>
                <h3 className="font-bold mb-1">Download</h3>
                <p className="text-sm text-gray-600">
                  Get your professional PDF CV instantly
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Component */}
        <VoiceToCVBuilder orgSlug={orgSlug} />

        {/* Tips */}
        <Card className="border-4 border-blue-500 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]">
          <CardContent className="p-6">
            <h2 className="text-xl font-black mb-4">💡 Tips for Best Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex gap-2">
                <span>✅</span>
                <span>Speak clearly in a quiet environment</span>
              </div>
              <div className="flex gap-2">
                <span>✅</span>
                <span>Mention your email and phone number</span>
              </div>
              <div className="flex gap-2">
                <span>✅</span>
                <span>Include specific dates (month/year)</span>
              </div>
              <div className="flex gap-2">
                <span>✅</span>
                <span>List your technical skills</span>
              </div>
              <div className="flex gap-2">
                <span>✅</span>
                <span>Describe your achievements</span>
              </div>
              <div className="flex gap-2">
                <span>✅</span>
                <span>Speak for at least 2 minutes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Example Script */}
        <Card className="border-4 border-green-500 shadow-[8px_8px_0px_0px_rgba(34,197,94,1)]">
          <CardContent className="p-6">
            <h2 className="text-xl font-black mb-4">📝 Example Script</h2>
            <div className="p-4 bg-green-50 border-2 border-green-500 rounded-lg">
              <p className="text-sm italic text-gray-700 leading-relaxed">
                "Hi, my name is Ahmed Al-Rashid, and my email is ahmed@example.com. 
                My phone number is +965 1234 5678. I graduated from Kuwait University 
                in 2020 with a Bachelor's degree in Computer Science. My GPA was 3.8 
                out of 4.0.
                <br /><br />
                I have three years of experience as a Software Developer at National Bank 
                of Kuwait, where I worked from January 2021 to present. I built mobile 
                banking applications using React Native and TypeScript, improving user 
                engagement by 40%. I also led a team of 3 developers on a digital wallet 
                project.
                <br /><br />
                My technical skills include JavaScript, TypeScript, React, React Native, 
                Python, Node.js, and AWS. I speak English and Arabic fluently. I have 
                strong communication and leadership skills.
                <br /><br />
                I also worked on a personal project called SmartBudget, a budgeting app 
                that helps users track expenses. I built it using React and Firebase, 
                and it has over 1,000 downloads on the App Store."
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VoiceCVPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold">Loading Voice-to-CV Builder...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <VoiceCVContent />
    </Suspense>
  );
}
