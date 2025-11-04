'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ThumbsUp, ThumbsDown, Play } from 'lucide-react';

interface AnalysisData {
  session: {
    id: string;
    status: string;
    interview_title: string;
    average_score: number | null;
  };
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  responses: Array<{
    question_id: string;
    question_text: string;
    question_order: number;
    video_url: string;
    duration: number;
    transcript: string;
    recorded_at: string;
    analysis: {
      overall_score: number;
      content_quality_score: number;
      communication_score: number;
      technical_score: number;
      ai_reasoning: string;
      key_strengths: string[];
      key_concerns: string[];
      detected_language: string;
      sentiment: string;
      analyzed_at: string;
    };
  }>;
}

interface InterviewResultsViewProps {
  sessionId: string;
}

export function InterviewResultsView({ sessionId }: InterviewResultsViewProps) {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<number>(0);

  useEffect(() => {
    fetchAnalysis();
    // Poll for updates every 5 seconds if any analysis is pending
    const interval = setInterval(() => {
      if (data?.responses.some(r => !r.analysis.overall_score)) {
        fetchAnalysis();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [sessionId]);

  const fetchAnalysis = async () => {
    try {
      const res = await fetch(`/api/interviews/${sessionId}/analysis`);
      if (!res.ok) throw new Error('Failed to fetch analysis');
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (err) {
      setError('Failed to load interview analysis');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-red-600">{error || 'No data found'}</p>
      </div>
    );
  }

  const currentResponse = data.responses[selectedResponse];
  const hasAnalysis = currentResponse?.analysis?.overall_score !== null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === 'positive') return <ThumbsUp className="w-4 h-4 text-green-600" />;
    if (sentiment === 'negative') return <ThumbsDown className="w-4 h-4 text-red-600" />;
    return <AlertCircle className="w-4 h-4 text-gray-600" />;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="bg-white border-2 border-black rounded-lg p-6 shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{data.session.interview_title}</h1>
            <p className="text-gray-600 mt-1">
              {data.candidate.name} • {data.candidate.email}
            </p>
          </div>
          {data.session.average_score !== null && (
            <div className="text-right">
              <div className="text-sm text-gray-600">Average Score</div>
              <div className={`text-4xl font-bold ${getScoreColor(data.session.average_score)}`}>
                {data.session.average_score}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Question Navigator */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {data.responses.map((response, idx) => {
          const score = response.analysis?.overall_score;
          return (
            <Button
              key={response.question_id}
              variant={selectedResponse === idx ? 'default' : 'outline'}
              onClick={() => setSelectedResponse(idx)}
              className="flex-shrink-0"
            >
              Q{idx + 1}
              {score !== null && (
                <Badge className="ml-2" variant="secondary">
                  {score}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Main Content */}
      {currentResponse && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Video & Transcript */}
          <div className="space-y-4">
            {/* Question */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Question {selectedResponse + 1}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{currentResponse.question_text}</p>
              </CardContent>
            </Card>

            {/* Video */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Video Response
                </CardTitle>
              </CardHeader>
              <CardContent>
                <video
                  src={currentResponse.video_url}
                  controls
                  className="w-full rounded-lg"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Duration: {Math.floor(currentResponse.duration / 60)}:{(currentResponse.duration % 60).toString().padStart(2, '0')}
                </p>
              </CardContent>
            </Card>

            {/* Transcript */}
            {currentResponse.transcript && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transcript</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {currentResponse.transcript}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: AI Analysis */}
          <div className="space-y-4">
            {!hasAnalysis ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">AI Analysis in progress...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Scores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Scores</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ScoreBar label="Overall" score={currentResponse.analysis.overall_score} />
                    <ScoreBar label="Content Quality" score={currentResponse.analysis.content_quality_score} />
                    <ScoreBar label="Communication" score={currentResponse.analysis.communication_score} />
                    <ScoreBar label="Technical Depth" score={currentResponse.analysis.technical_score} />
                    
                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-sm text-gray-600">Sentiment:</span>
                      {getSentimentIcon(currentResponse.analysis.sentiment)}
                      <span className="text-sm capitalize">{currentResponse.analysis.sentiment}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Reasoning */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">AI Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {currentResponse.analysis.ai_reasoning}
                    </p>
                  </CardContent>
                </Card>

                {/* Strengths */}
                {currentResponse.analysis.key_strengths.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        Key Strengths
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-1">
                        {currentResponse.analysis.key_strengths.map((strength, idx) => (
                          <li key={idx} className="text-gray-700">{strength}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Concerns */}
                {currentResponse.analysis.key_concerns.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        Areas for Improvement
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-1">
                        {currentResponse.analysis.key_concerns.map((concern, idx) => (
                          <li key={idx} className="text-gray-700">{concern}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Score Bar Component
function ScoreBar({ label, score }: { label: string; score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return 'bg-green-500';
    if (s >= 60) return 'bg-blue-500';
    if (s >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor(score)} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
