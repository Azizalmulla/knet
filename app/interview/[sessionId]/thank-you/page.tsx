import { CheckCircle2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ThankYouPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white border-2 border-black rounded-lg shadow-[8px_8px_0_#111] p-8 text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-4">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Interview Complete! 🎉</h1>
          <p className="text-xl text-gray-600">
            Thank you for taking the time to complete your interview
          </p>
        </div>

        <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div className="text-left">
              <h3 className="font-semibold text-lg mb-2">What happens next?</h3>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>Our AI is analyzing your responses right now</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>The hiring team will review your interview within 2-3 business days</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span>You'll receive an email with the next steps</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600">
            We appreciate your interest in joining our team. If you have any questions in the meantime, 
            feel free to reach out to our recruitment team.
          </p>
          
          <div className="pt-4">
            <Link href="/">
              <Button size="lg" className="bg-black hover:bg-gray-800 text-white">
                Return to Home
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Powered by <strong>Wathefni AI</strong> • Interview Intelligence Platform
          </p>
        </div>
      </div>
    </div>
  );
}
