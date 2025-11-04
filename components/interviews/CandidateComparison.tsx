'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CandidateData {
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  average_score: number;
  responses: Array<{
    question_text: string;
    overall_score: number;
    content_quality_score: number;
    communication_score: number;
    technical_score: number;
    key_strengths: string[];
    key_concerns: string[];
    sentiment: string;
  }>;
}

interface CandidateComparisonProps {
  sessionIds: string[];
}

export function CandidateComparison({ sessionIds }: CandidateComparisonProps) {
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCandidates();
  }, [sessionIds]);

  const fetchCandidates = async () => {
    try {
      const promises = sessionIds.map(id =>
        fetch(`/api/interviews/${id}/analysis`).then(r => r.json())
      );
      const results = await Promise.all(promises);
      
      const candidatesData = results.map(data => ({
        session_id: data.session.id,
        candidate_name: data.candidate.name,
        candidate_email: data.candidate.email,
        average_score: data.session.average_score,
        responses: data.responses.map((r: any) => ({
          question_text: r.question_text,
          overall_score: r.analysis?.overall_score || 0,
          content_quality_score: r.analysis?.content_quality_score || 0,
          communication_score: r.analysis?.communication_score || 0,
          technical_score: r.analysis?.technical_score || 0,
          key_strengths: r.analysis?.key_strengths || [],
          key_concerns: r.analysis?.key_concerns || [],
          sentiment: r.analysis?.sentiment || 'neutral',
        })),
      }));

      setCandidates(candidatesData);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch candidates:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading comparison...</div>;
  }

  if (candidates.length === 0) {
    return <div className="text-center py-12">No candidates to compare</div>;
  }

  // Calculate winner for each metric
  const getWinner = (metric: 'average' | 'content' | 'communication' | 'technical') => {
    const scores = candidates.map(c => {
      if (metric === 'average') return c.average_score;
      const avg = c.responses.reduce((sum, r) => {
        if (metric === 'content') return sum + r.content_quality_score;
        if (metric === 'communication') return sum + r.communication_score;
        if (metric === 'technical') return sum + r.technical_score;
        return sum;
      }, 0) / c.responses.length;
      return Math.round(avg);
    });
    const maxScore = Math.max(...scores);
    return scores.map(s => s === maxScore);
  };

  const avgWinners = getWinner('average');
  const contentWinners = getWinner('content');
  const commWinners = getWinner('communication');
  const techWinners = getWinner('technical');

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Candidate Comparison</h1>

      {/* Overview Cards */}
      <div className={`grid grid-cols-${candidates.length} gap-4`}>
        {candidates.map((candidate, idx) => (
          <Card key={candidate.session_id} className={avgWinners[idx] ? 'border-green-500 border-2' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{candidate.candidate_name}</span>
                {avgWinners[idx] && <Badge className="bg-green-500">Best</Badge>}
              </CardTitle>
              <p className="text-sm text-gray-600">{candidate.candidate_email}</p>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-5xl font-bold text-gray-900">
                  {candidate.average_score}
                </div>
                <div className="text-sm text-gray-600 mt-1">Average Score</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed Metrics Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Score Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Content Quality */}
            <MetricRow
              label="Content Quality"
              candidates={candidates}
              winners={contentWinners}
              getScore={(c) => {
                const avg = c.responses.reduce((sum, r) => sum + r.content_quality_score, 0) / c.responses.length;
                return Math.round(avg);
              }}
            />

            {/* Communication */}
            <MetricRow
              label="Communication"
              candidates={candidates}
              winners={commWinners}
              getScore={(c) => {
                const avg = c.responses.reduce((sum, r) => sum + r.communication_score, 0) / c.responses.length;
                return Math.round(avg);
              }}
            />

            {/* Technical */}
            <MetricRow
              label="Technical Depth"
              candidates={candidates}
              winners={techWinners}
              getScore={(c) => {
                const avg = c.responses.reduce((sum, r) => sum + r.technical_score, 0) / c.responses.length;
                return Math.round(avg);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Strengths & Concerns */}
      <div className={`grid grid-cols-${candidates.length} gap-4`}>
        {candidates.map((candidate) => {
          const allStrengths = candidate.responses.flatMap(r => r.key_strengths);
          const allConcerns = candidate.responses.flatMap(r => r.key_concerns);
          const uniqueStrengths = [...new Set(allStrengths)];
          const uniqueConcerns = [...new Set(allConcerns)];

          return (
            <div key={candidate.session_id} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {uniqueStrengths.slice(0, 5).map((strength, idx) => (
                      <li key={idx} className="text-gray-700">{strength}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    Concerns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc pl-5 space-y-1 text-sm">
                    {uniqueConcerns.slice(0, 5).map((concern, idx) => (
                      <li key={idx} className="text-gray-700">{concern}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Recommendation */}
      <Card className="border-2 border-green-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            AI Recommendation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const bestIdx = candidates.findIndex((_, idx) => avgWinners[idx]);
            const best = candidates[bestIdx];
            const others = candidates.filter((_, idx) => idx !== bestIdx);

            return (
              <div className="space-y-2">
                <p className="text-lg">
                  <strong>{best.candidate_name}</strong> has the highest overall score ({best.average_score}/100)
                  and demonstrates strong performance across multiple dimensions.
                </p>
                <p className="text-gray-700">
                  Compared to other candidates, {best.candidate_name} excels in{' '}
                  {contentWinners[bestIdx] && 'content quality'}
                  {contentWinners[bestIdx] && commWinners[bestIdx] ? ' and ' : ''}
                  {commWinners[bestIdx] && 'communication'}
                  .
                </p>
                <p className="text-sm text-gray-600 mt-4">
                  <em>Note: This is an AI-generated recommendation. Please review individual responses for final decision.</em>
                </p>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

// Metric Row Component
function MetricRow({
  label,
  candidates,
  winners,
  getScore,
}: {
  label: string;
  candidates: CandidateData[];
  winners: boolean[];
  getScore: (c: CandidateData) => number;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-gray-700 mb-2">{label}</div>
      <div className={`grid grid-cols-${candidates.length} gap-4`}>
        {candidates.map((candidate, idx) => {
          const score = getScore(candidate);
          const isWinner = winners[idx];
          return (
            <div key={candidate.session_id} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-2xl font-bold">{score}</span>
                {isWinner && <TrendingUp className="w-5 h-5 text-green-600" />}
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${isWinner ? 'bg-green-500' : 'bg-blue-500'} transition-all duration-500`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
