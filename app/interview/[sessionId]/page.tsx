'use client';

import { useState, useEffect } from 'react';
import { VideoRecorder } from '@/components/interviews/VideoRecorder';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Question {
  id: string;
  question_text: string;
  time_limit_seconds: number;
  order_index: number;
  has_response: boolean;
}

interface InterviewSession {
  id: string;
  interview_title: string;
  candidate_name: string;
  status: string;
  expires_at: string;
  questions: Question[];
}

export default function InterviewPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSession();
  }, [params.sessionId]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/interviews/${params.sessionId}/session`);
      if (!res.ok) throw new Error('Session not found or expired');
      const data = await res.json();
      setSession(data);
      
      // Find first unanswered question
      const firstUnanswered = data.questions.findIndex((q: Question) => !q.has_response);
      if (firstUnanswered !== -1) {
        setCurrentQuestionIndex(firstUnanswered);
      }
      
      setLoading(false);
    } catch (err) {
      setError('Failed to load interview. Please check your link.');
      setLoading(false);
    }
  };

  const handleRecordingComplete = async (blob: Blob, duration: number) => {
    if (!session) return;
    
    setUploading(true);
    setError(null);

    try {
      const currentQuestion = session.questions[currentQuestionIndex];
      
      const formData = new FormData();
      formData.append('video', blob, 'interview-response.webm');
      formData.append('questionId', currentQuestion.id);
      formData.append('duration', duration.toString());

      const res = await fetch(`/api/interviews/${params.sessionId}/response`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      // Mark question as answered
      const updatedQuestions = [...session.questions];
      updatedQuestions[currentQuestionIndex].has_response = true;
      setSession({ ...session, questions: updatedQuestions });

      // Move to next question or finish
      const nextUnanswered = updatedQuestions.findIndex((q, idx) => idx > currentQuestionIndex && !q.has_response);
      
      if (nextUnanswered !== -1) {
        setCurrentQuestionIndex(nextUnanswered);
      } else {
        // All questions answered - mark session complete
        await fetch(`/api/interviews/${params.sessionId}/complete`, {
          method: 'POST',
        });
        router.push(`/interview/${params.sessionId}/thank-you`);
      }
    } catch (err) {
      setError('Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Interview Not Found</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const currentQuestion = session.questions[currentQuestionIndex];
  const completedCount = session.questions.filter(q => q.has_response).length;
  const totalCount = session.questions.length;
  const progress = (completedCount / totalCount) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b-2 border-black">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{session.interview_title}</h1>
              <p className="text-gray-600">Welcome, {session.candidate_name}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Progress</div>
              <div className="text-2xl font-bold">{completedCount}/{totalCount}</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Question Navigator */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {session.questions.map((q, idx) => (
            <Button
              key={q.id}
              variant={currentQuestionIndex === idx ? 'default' : 'outline'}
              onClick={() => setCurrentQuestionIndex(idx)}
              disabled={uploading}
              className="flex-shrink-0"
            >
              Q{idx + 1}
              {q.has_response && <CheckCircle2 className="w-4 h-4 ml-1 text-green-500" />}
            </Button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-500 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Uploading Overlay */}
        {uploading && (
          <div className="mb-6 bg-blue-50 border-2 border-blue-500 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <div>
                <div className="font-semibold">Uploading your response...</div>
                <div className="text-sm text-gray-600">AI analysis will begin automatically</div>
              </div>
            </div>
          </div>
        )}

        {/* Video Recorder */}
        {!uploading && (
          <VideoRecorder
            questionText={currentQuestion.question_text}
            timeLimitSeconds={currentQuestion.time_limit_seconds}
            onRecordingComplete={handleRecordingComplete}
          />
        )}

        {/* Instructions */}
        {currentQuestion.has_response && !uploading && (
          <div className="mt-6 bg-green-50 border-2 border-green-500 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <div className="font-semibold">Response submitted!</div>
                <div className="text-sm text-gray-600">
                  {completedCount < totalCount ? 'Click next question to continue' : 'All questions completed!'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
