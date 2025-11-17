'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, 
  Lightbulb, RefreshCw, Download, Sparkles 
} from 'lucide-react';

interface SkillData {
  skill: string;
  count: number;
  percentage: number;
  category: 'abundant' | 'balanced' | 'scarce';
}

interface SkillsGapData {
  totalCandidates: number;
  abundantSkills: SkillData[];
  balancedSkills: SkillData[];
  scarceSkills: SkillData[];
  recommendations: string[];
  industryInsights: {
    topTrendingSkills: string[];
    emergingSkills: string[];
  };
}

const COLORS = {
  abundant: '#10b981', // green
  balanced: '#f59e0b', // amber
  scarce: '#ef4444', // red
};

const PIE_COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1'];

interface SkillsGapAnalysisProps {
  orgSlug: string;
}

export function SkillsGapAnalysis({ orgSlug }: SkillsGapAnalysisProps) {
  const [data, setData] = useState<SkillsGapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, [orgSlug]);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`/api/${orgSlug}/admin/skills-gap`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch skills gap analysis');
      }

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    const rows = [
      ['Skill', 'Count', 'Percentage', 'Category'],
      ...data.abundantSkills.map(s => [s.skill, s.count, s.percentage, s.category]),
      ...data.balancedSkills.map(s => [s.skill, s.count, s.percentage, s.category]),
      ...data.scarceSkills.map(s => [s.skill, s.count, s.percentage, s.category]),
    ];

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skills-gap-${orgSlug}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-bold">Analyzing your talent pool...</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <p className="text-lg font-bold mb-4">{error || 'Failed to load analysis'}</p>
          <Button onClick={fetchAnalysis} className="bg-black text-white hover:bg-gray-800">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Prepare chart data
  const topSkillsData = [...data.abundantSkills, ...data.balancedSkills]
    .slice(0, 10)
    .map(s => ({
      name: s.skill.charAt(0).toUpperCase() + s.skill.slice(1),
      candidates: s.count,
      percentage: s.percentage,
    }));

  const categoryDistribution = [
    { name: 'Abundant (>60%)', value: data.abundantSkills.length, color: COLORS.abundant },
    { name: 'Balanced (30-60%)', value: data.balancedSkills.length, color: COLORS.balanced },
    { name: 'Scarce (<30%)', value: data.scarceSkills.length, color: COLORS.scarce },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black mb-2">Skills Gap Analysis</h2>
          <p className="text-gray-600">
            Analyzing <span className="font-bold">{data.totalCandidates}</span> candidates
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={fetchAnalysis}
            variant="outline"
            className="border-2 border-black"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={exportToCSV}
            className="bg-black text-white hover:bg-gray-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Key Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-4 border-green-500 shadow-[4px_4px_0px_0px_rgba(34,197,94,1)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Abundant Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black mb-2">{data.abundantSkills.length}</div>
            <p className="text-sm text-gray-600">Strong talent pool</p>
          </CardContent>
        </Card>

        <Card className="border-4 border-amber-500 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              Balanced Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black mb-2">{data.balancedSkills.length}</div>
            <p className="text-sm text-gray-600">Moderate coverage</p>
          </CardContent>
        </Card>

        <Card className="border-4 border-red-500 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Scarce Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black mb-2">{data.scarceSkills.length}</div>
            <p className="text-sm text-gray-600">Hiring/training needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card className="border-4 border-purple-500 shadow-[8px_8px_0px_0px_rgba(168,85,247,1)] bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-purple-500" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recommendations.map((rec, idx) => (
            <div key={idx} className="flex gap-3">
              <Sparkles className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{rec}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart - Top Skills */}
        <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle>Top 10 Skills in Your Pool</CardTitle>
            <CardDescription>Most common skills among candidates</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSkillsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={100}
                  style={{ fontSize: '12px' }}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="candidates" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart - Category Distribution */}
        <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle>Skills Coverage Distribution</CardTitle>
            <CardDescription>How skills are distributed by availability</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Skills Lists */}
      <Tabs defaultValue="abundant" className="w-full">
        <TabsList className="grid w-full grid-cols-3 border-2 border-black">
          <TabsTrigger value="abundant" className="font-bold">
            ✅ Abundant ({data.abundantSkills.length})
          </TabsTrigger>
          <TabsTrigger value="balanced" className="font-bold">
            ⚖️ Balanced ({data.balancedSkills.length})
          </TabsTrigger>
          <TabsTrigger value="scarce" className="font-bold">
            ⚠️ Scarce ({data.scarceSkills.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="abundant">
          <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle>Abundant Skills (Strong Pool)</CardTitle>
              <CardDescription>These skills are well-represented in your candidate pool</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.abundantSkills.map((skill, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border-2 border-green-500">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-500 text-white font-bold">
                        {skill.percentage}%
                      </Badge>
                      <span className="font-bold capitalize">{skill.skill}</span>
                    </div>
                    <span className="text-sm text-gray-600">{skill.count} candidates</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balanced">
          <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle>Balanced Skills (Moderate Pool)</CardTitle>
              <CardDescription>These skills have moderate representation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.balancedSkills.map((skill, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border-2 border-amber-500">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-500 text-white font-bold">
                        {skill.percentage}%
                      </Badge>
                      <span className="font-bold capitalize">{skill.skill}</span>
                    </div>
                    <span className="text-sm text-gray-600">{skill.count} candidates</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scarce">
          <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle>Scarce Skills (Limited Pool)</CardTitle>
              <CardDescription>These skills are underrepresented - consider focused recruitment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.scarceSkills.map((skill, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border-2 border-red-500">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-500 text-white font-bold">
                        {skill.percentage}%
                      </Badge>
                      <span className="font-bold capitalize">{skill.skill}</span>
                    </div>
                    <span className="text-sm text-gray-600">{skill.count} candidates</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Industry Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-4 border-blue-500 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Industry Trending Skills
            </CardTitle>
            <CardDescription>Most in-demand skills in the job market</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.industryInsights.topTrendingSkills.map((skill, idx) => (
                <Badge key={idx} variant="outline" className="border-2 border-blue-500 text-blue-700 font-bold">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-4 border-pink-500 shadow-[8px_8px_0px_0px_rgba(236,72,153,1)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-500" />
              Emerging Skills
            </CardTitle>
            <CardDescription>Future-focused skills gaining traction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.industryInsights.emergingSkills.map((skill, idx) => (
                <Badge key={idx} variant="outline" className="border-2 border-pink-500 text-pink-700 font-bold">
                  {skill}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
