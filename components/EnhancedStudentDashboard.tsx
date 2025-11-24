'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target, TrendingUp, Briefcase, Calendar, Clock, CheckCircle2,
  XCircle, AlertCircle, Sparkles, Award, BookOpen, MapPin,
  DollarSign, Video, ExternalLink, RefreshCw, ArrowRight,
  Star, Zap, Users, Building2, FileText, Mail, Phone
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface DashboardData {
  profile: {
    name: string;
    email: string;
    phone: string;
    profileStrength: number;
    completionTips: string[];
    topSkills: string[];
    yearsExperience: number;
  };
  applications: {
    total: number;
    pending: number;
    reviewing: number;
    interviewed: number;
    accepted: number;
    rejected: number;
    recentApplications: any[];
  };
  matchedJobs: any[];
  upcomingInterviews: any[];
  recommendations: {
    skillsToLearn: string[];
    careerPaths: string[];
    improvementTips: string[];
  };
  activityFeed: any[];
}

export function EnhancedStudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/candidate/dashboard');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to load dashboard');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-[28px] border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-black" />
            <p className="text-lg font-extrabold text-black">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-[28px] border-[3px] border-black bg-[#ffcccb] shadow-[6px_6px_0_#111] p-12 text-center">
            <XCircle className="w-16 h-16 text-black mx-auto mb-4" />
            <h3 className="text-2xl font-extrabold mb-2 text-black">Failed to Load Dashboard</h3>
            <p className="text-neutral-700 mb-4">{error}</p>
            <Button onClick={fetchDashboard} className="rounded-2xl border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform font-bold">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Show empty state if no data
  if (!data || data.profile.profileStrength === 0) {
    return (
      <div className="min-h-screen bg-[#eeeee4] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-[28px] border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
            <Sparkles className="w-16 h-16 text-black mx-auto mb-4" />
            <h3 className="text-2xl font-extrabold mb-2 text-black">Welcome to Your Career Dashboard!</h3>
            <p className="text-neutral-600 mb-6">Get started by uploading your CV or building one with AI</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="rounded-2xl border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform font-bold">
                <Link href="/start">
                  <FileText className="w-4 h-4 mr-2" />
                  Upload CV
                </Link>
              </Button>
              <Button asChild className="rounded-2xl border-[3px] border-black bg-[#ffd6a5] text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform font-bold">
                <Link href="/career/ai-builder">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Build with AI
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-500';
      case 'rejected': return 'bg-red-500';
      case 'interviewed': return 'bg-blue-500';
      case 'reviewing': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return CheckCircle2;
      case 'rejected': return XCircle;
      case 'interviewed': return Video;
      case 'reviewing': return Clock;
      default: return AlertCircle;
    }
  };

  return (
    <div className="min-h-screen bg-[#eeeee4] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-extrabold mb-2 text-black border-b-[4px] border-black inline-block pr-2">Your Career Dashboard</h1>
            <p className="text-neutral-600 mt-4">Track your progress and discover opportunities</p>
          </div>
          <Button
            onClick={fetchDashboard}
            className="rounded-2xl border-[3px] border-black bg-white text-black shadow-[3px_3px_0_#111] hover:-translate-y-0.5 hover:bg-zinc-100 transition-transform font-bold"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Profile Strength Card */}
        <div className="rounded-[28px] border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-6">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-2xl font-extrabold text-black">
              <Target className="w-6 h-6 text-black" />
              Profile Strength: {data.profile.profileStrength}%
            </h2>
            <p className="text-neutral-600 mt-1">Complete your profile to get better matches</p>
          </div>
          <div className="space-y-4">
            <div className="relative h-6 bg-neutral-200 rounded-full border-[3px] border-black overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-black transition-all duration-500"
                style={{ width: `${data.profile.profileStrength}%` }}
              />
            </div>
            
            {data.profile.completionTips.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="font-extrabold flex items-center gap-2 text-black">
                  <Sparkles className="w-4 h-4" />
                  Quick Wins:
                </p>
                {data.profile.completionTips.map((tip, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-neutral-700">
                    <ArrowRight className="w-4 h-4 text-black" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t-[3px] border-black">
              <p className="font-extrabold mb-2 text-black">Your Top Skills:</p>
              <div className="flex flex-wrap gap-2">
                {data.profile.topSkills.map((skill, idx) => (
                  <span key={idx} className="px-3 py-1 rounded-full border-[2px] border-black bg-[#ffd6a5] text-black font-bold text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl border-[3px] border-black bg-[#a8dadc] shadow-[4px_4px_0_#111] p-4">
            <div className="text-sm font-bold text-black mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Total Applied
            </div>
            <div className="text-4xl font-extrabold text-black">{data.applications.total}</div>
          </div>

          <div className="rounded-2xl border-[3px] border-black bg-[#ffd6a5] shadow-[4px_4px_0_#111] p-4">
            <div className="text-sm font-bold text-black mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Under Review
            </div>
            <div className="text-4xl font-extrabold text-black">{data.applications.reviewing + data.applications.pending}</div>
          </div>

          <div className="rounded-2xl border-[3px] border-black bg-[#e0c3fc] shadow-[4px_4px_0_#111] p-4">
            <div className="text-sm font-bold text-black mb-2 flex items-center gap-2">
              <Video className="w-4 h-4" />
              Interviewed
            </div>
            <div className="text-4xl font-extrabold text-black">{data.applications.interviewed}</div>
          </div>

          <div className="rounded-2xl border-[3px] border-black bg-[#d4f1dd] shadow-[4px_4px_0_#111] p-4">
            <div className="text-sm font-bold text-black mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Accepted
            </div>
            <div className="text-4xl font-extrabold text-black">{data.applications.accepted}</div>
          </div>

          <div className="rounded-2xl border-[3px] border-black bg-[#ffcccb] shadow-[4px_4px_0_#111] p-4">
            <div className="text-sm font-bold text-black mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Rejected
            </div>
            <div className="text-4xl font-extrabold text-black">{data.applications.rejected}</div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="matched-jobs" className="w-full">
          <div className="grid w-full grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <TabsTrigger value="matched-jobs" className="rounded-2xl border-[3px] border-black bg-white shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform data-[state=active]:bg-black data-[state=active]:text-white font-bold p-3">
              🎯 Jobs ({data.matchedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="interviews" className="rounded-2xl border-[3px] border-black bg-white shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform data-[state=active]:bg-black data-[state=active]:text-white font-bold p-3">
              📅 Interviews ({data.upcomingInterviews.length})
            </TabsTrigger>
            <TabsTrigger value="applications" className="rounded-2xl border-[3px] border-black bg-white shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform data-[state=active]:bg-black data-[state=active]:text-white font-bold p-3">
              📋 Apps ({data.applications.recentApplications.length})
            </TabsTrigger>
            <TabsTrigger value="insights" className="rounded-2xl border-[3px] border-black bg-white shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform data-[state=active]:bg-black data-[state=active]:text-white font-bold p-3">
              💡 Insights
            </TabsTrigger>
          </div>

          {/* Matched Jobs Tab */}
          <TabsContent value="matched-jobs">
            {data.matchedJobs.length === 0 ? (
              <div className="rounded-[28px] border-[3px] border-black bg-white shadow-[6px_6px_0_#111] p-12 text-center">
                <Briefcase className="w-16 h-16 text-neutral-400 mx-auto mb-4" />
                <h3 className="text-2xl font-extrabold mb-2 text-black">No matched jobs yet</h3>
                <p className="text-neutral-600 mb-4">
                  Complete your profile to get personalized job matches
                </p>
                <Button asChild className="rounded-2xl border-[3px] border-black bg-black text-white shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform font-bold">
                  <Link href="/jobs">Browse All Jobs</Link>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.matchedJobs.map((job: any) => (
                  <div key={job.id} className="rounded-2xl border-[3px] border-black bg-white shadow-[6px_6px_0_#111] hover:shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-all p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-xl font-extrabold text-black mb-1">{job.title}</h3>
                        <p className="text-neutral-600 flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4" />
                          {job.company}
                        </p>
                      </div>
                      <span className="px-3 py-1 rounded-full border-[2px] border-black bg-[#d4f1dd] text-black font-bold text-sm">
                        {job.matchScore}% Match
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-neutral-700">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        {job.salaryRange || 'Competitive'}
                      </span>
                    </div>
                    
                    <div>
                      <p className="text-sm font-bold mb-2 text-black">Matched Skills:</p>
                      <div className="flex flex-wrap gap-2">
                        {job.matchedSkills.slice(0, 5).map((skill: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 rounded-lg border-[2px] border-black bg-neutral-100 text-black text-xs font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Button asChild className="w-full rounded-2xl border-[3px] border-black bg-black text-white shadow-[3px_3px_0_#111] hover:-translate-y-0.5 transition-transform font-bold">
                      <Link href={`/jobs/${job.id}`}>
                        View Job <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Upcoming Interviews Tab */}
          <TabsContent value="interviews">
            {data.upcomingInterviews.length === 0 ? (
              <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="p-12 text-center">
                  <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">No upcoming interviews</h3>
                  <p className="text-gray-600">
                    Keep applying! Your next interview could be just around the corner.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {data.upcomingInterviews.map((interview: any) => (
                  <Card key={interview.id} className="border-4 border-blue-500 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-3 flex-1">
                          <div>
                            <h3 className="text-xl font-black mb-1">{interview.position}</h3>
                            <p className="text-gray-600 flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              {interview.company}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(interview.startTime).toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {new Date(interview.startTime).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>

                          <Badge className="bg-blue-500 text-white">
                            {interview.type} Interview
                          </Badge>
                        </div>

                        <Button asChild className="bg-blue-500 text-white hover:bg-blue-600">
                          <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer">
                            <Video className="w-4 h-4 mr-2" />
                            Join Meeting
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Applications Tab */}
          <TabsContent value="applications">
            <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>Track your application status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.applications.recentApplications.map((app: any) => {
                    const StatusIcon = getStatusIcon(app.status);
                    return (
                      <div key={app.id} className="flex items-center justify-between p-4 border-2 border-black rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg border-2 border-black ${getStatusColor(app.status)} flex items-center justify-center`}>
                            <StatusIcon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-bold">{app.orgName}</p>
                            <p className="text-sm text-gray-600">
                              Applied {new Date(app.appliedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge className={`${getStatusColor(app.status)} text-white font-bold`}>
                          {app.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Career Insights Tab */}
          <TabsContent value="insights">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Skills to Learn */}
              <Card className="border-4 border-orange-500 shadow-[8px_8px_0px_0px_rgba(249,115,22,1)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-orange-500" />
                    Skills to Learn
                  </CardTitle>
                  <CardDescription>Trending skills for your career</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.recommendations.skillsToLearn.map((skill, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border-2 border-orange-500">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <span className="font-bold">{skill}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Career Paths */}
              <Card className="border-4 border-green-500 shadow-[8px_8px_0px_0px_rgba(34,197,94,1)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Career Paths
                  </CardTitle>
                  <CardDescription>Potential career directions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.recommendations.careerPaths.map((path, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border-2 border-green-500">
                        <Star className="w-4 h-4 text-green-500" />
                        <span className="font-bold">{path}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Improvement Tips */}
              <Card className="border-4 border-purple-500 shadow-[8px_8px_0px_0px_rgba(168,85,247,1)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-purple-500" />
                    Pro Tips
                  </CardTitle>
                  <CardDescription>Actionable improvements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.recommendations.improvementTips.map((tip, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border-2 border-purple-500">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-sm">{tip}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card className="border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button asChild className="h-auto p-6 bg-purple-500 hover:bg-purple-600 text-white">
                <Link href="/jobs">
                  <div className="flex flex-col items-center gap-2">
                    <Briefcase className="w-8 h-8" />
                    <span className="font-bold">Browse Jobs</span>
                  </div>
                </Link>
              </Button>
              
              <Button asChild className="h-auto p-6 bg-blue-500 hover:bg-blue-600 text-white">
                <Link href="/ai-builder">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8" />
                    <span className="font-bold">Build CV</span>
                  </div>
                </Link>
              </Button>
              
              <Button asChild className="h-auto p-6 bg-green-500 hover:bg-green-600 text-white">
                <Link href="/upload">
                  <div className="flex flex-col items-center gap-2">
                    <TrendingUp className="w-8 h-8" />
                    <span className="font-bold">Upload CV</span>
                  </div>
                </Link>
              </Button>
              
              <Button asChild className="h-auto p-6 bg-orange-500 hover:bg-orange-600 text-white">
                <Link href="/career-assistant">
                  <div className="flex flex-col items-center gap-2">
                    <Sparkles className="w-8 h-8" />
                    <span className="font-bold">AI Assistant</span>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
